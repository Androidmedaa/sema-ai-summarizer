import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from './config'
import api from '../utils/axios'

// Kullanıcı kaydı
export const registerUser = async (email, password, name) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Kullanıcı profilini güncelle
    await updateProfile(user, {
      displayName: name
    })

    // Firestore'da kullanıcı bilgilerini kaydet (pasif)
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      createdAt: new Date().toISOString(),
      documents: [],
      status: 'pending',
      emailVerified: false
    })

    // Doğrulama e-postası gönder
    await sendEmailVerification(user)

    // Otomatik giriş yapılmasın diye çıkış yap
    await signOut(auth)

    return {
      user: {
        uid: user.uid,
        email: user.email,
        name: name
      },
      requiresVerification: true,
      message: 'Doğrulama e-postası gönderildi. Lütfen e-posta adresinizi doğrulayın.'
    }
  } catch (error) {
    throw new Error(getErrorMessage(error.code))
  }
}

// Kullanıcı girişi
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Email doğrulama kontrolü - Geçici olarak devre dışı (geliştirme için)
    // if (!user.emailVerified) {
    //   await signOut(auth)
    //   throw new Error('E-posta doğrulanmamış. Lütfen e-postanızı doğrulayın.')
    // }

    // Firestore'dan kullanıcı bilgilerini al
    const userRef = doc(db, 'users', user.uid)
    const userDoc = await getDoc(userRef)

    // Kullanıcı kaydı yoksa oluştur veya pasifse aktif et
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        name: user.displayName || '',
        email: user.email,
        createdAt: new Date().toISOString(),
        documents: [],
        status: 'active',
        emailVerified: true
      })
    } else if (userDoc.exists() && !userDoc.data().emailVerified) {
      await updateDoc(userRef, {
        status: 'active',
        emailVerified: true
      })
    }

    const userData = (await getDoc(userRef)).data()

    const userInfo = {
      uid: user.uid,
      email: user.email,
      name: userData?.name || user.displayName || ''
    }

    // Giriş bildirimi e-postası gönder (asenkron, hata olsa bile devam et)
    api.post('/auth/notify-login', {
      email: userInfo.email,
      name: userInfo.name
    }).catch(err => {
      console.error('Login notification failed:', err)
      // Hata olsa bile devam et
    })

    return {
      user: userInfo,
      token: await user.getIdToken()
    }
  } catch (error) {
    throw new Error(getErrorMessage(error.code))
  }
}

// Kullanıcı çıkışı
export const logoutUser = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    throw new Error('Çıkış yapılırken hata oluştu')
  }
}

// Auth state değişikliğini dinle
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user && user.emailVerified) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        const userData = userDoc.data()
        callback({
          uid: user.uid,
          email: user.email,
          name: userData?.name || user.displayName || ''
        })
      } catch (error) {
        callback(null)
      }
    } else {
      callback(null)
    }
  })
}

// Mevcut kullanıcıyı al
export const getCurrentUser = () => {
  return auth.currentUser
}

// Email güncelleme
export const updateUserEmail = async (newEmail, password) => {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('Kullanıcı oturumu bulunamadı')
    }

    // Önce kullanıcıyı yeniden doğrula
    const credential = EmailAuthProvider.credential(user.email, password)
    await reauthenticateWithCredential(user, credential)

    // Email'i güncelle
    await updateEmail(user, newEmail)

    // Firestore'da email'i güncelle
    const userRef = doc(db, 'users', user.uid)
    await updateDoc(userRef, {
      email: newEmail
    })

    return { success: true, message: 'E-posta adresi başarıyla güncellendi' }
  } catch (error) {
    throw new Error(getErrorMessage(error.code))
  }
}

// Şifre güncelleme
export const updateUserPassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('Kullanıcı oturumu bulunamadı')
    }

    // Önce kullanıcıyı yeniden doğrula
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)

    // Şifreyi güncelle
    await updatePassword(user, newPassword)

    return { success: true, message: 'Şifre başarıyla güncellendi' }
  } catch (error) {
    throw new Error(getErrorMessage(error.code))
  }
}

// Hata mesajlarını Türkçe'ye çevir
const getErrorMessage = (errorCode) => {
  const errorMessages = {
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor',
    'auth/invalid-email': 'Geçersiz e-posta adresi',
    'auth/operation-not-allowed': 'Bu işlem şu anda izin verilmiyor',
    'auth/weak-password': 'Şifre çok zayıf. En az 6 karakter olmalıdır',
    'auth/user-disabled': 'Bu kullanıcı hesabı devre dışı bırakılmış',
    'auth/user-not-found': 'Kullanıcı bulunamadı',
    'auth/wrong-password': 'Yanlış şifre',
    'auth/too-many-requests': 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin',
    'auth/network-request-failed': 'Ağ hatası. İnternet bağlantınızı kontrol edin',
    'auth/requires-recent-login': 'Bu işlem için lütfen tekrar giriş yapın',
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanılıyor',
    'auth/invalid-credential': 'Geçersiz kimlik bilgileri'
  }
  return errorMessages[errorCode] || 'Bir hata oluştu. Lütfen tekrar deneyin'
}

