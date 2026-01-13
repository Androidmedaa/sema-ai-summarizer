import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './config'

// Sadece Firestore'a metadata kaydet (Storage olmadan, daha hızlı)
export const saveDocumentToFirestore = async (userId, documentData) => {
  try {
    console.log('📝 Firestore\'a kaydediliyor (Storage olmadan)...')
    
    // Text alanını kısalt (Firestore limit: 1MB per field, güvenli limit: 500KB)
    const maxTextLength = 500000 // 500KB
    const textContent = (documentData.text || '').substring(0, maxTextLength)
    
    const firestoreData = {
      userId: userId,
      filename: documentData.filename || '',
      fileUrl: '', // Storage kullanmıyoruz, boş bırak
      filepath: '', // Storage kullanmıyoruz, boş bırak
      type: documentData.type || '',
      text: textContent,
      summary: (documentData.summary || '').substring(0, 10000), // Summary limit: 10KB
      keywords: Array.isArray(documentData.keywords) ? documentData.keywords.slice(0, 50) : [], // Max 50 keywords
      folderId: documentData.folderId || null, // Klasör ID'sini ekle
      uploadedAt: Timestamp.now()
    }
    
    // Backend ID'yi sakla
    if (documentData.id) {
      firestoreData.backendId = documentData.id
    }
    
    console.log('📝 Firestore verisi hazır:', {
      userId: firestoreData.userId,
      filename: firestoreData.filename,
      type: firestoreData.type,
      textLength: firestoreData.text.length,
      summaryLength: firestoreData.summary.length,
      keywordsCount: firestoreData.keywords.length
    })
    
    const docRef = await addDoc(collection(db, 'documents'), firestoreData)
    console.log('✅ Firestore\'a kaydedildi:', docRef.id)
    
    return {
      id: docRef.id,
      ...documentData,
      uploadedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ Firestore kayıt hatası:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message
    })
    
    if (error.code === 'permission-denied') {
      throw new Error('Firestore izin hatası: Güvenlik kurallarını kontrol edin')
    } else if (error.code === 'invalid-argument') {
      throw new Error('Firestore veri hatası: Veri formatı geçersiz')
    } else {
      throw new Error(`Firestore kayıt hatası: ${error.code} - ${error.message}`)
    }
  }
}

// Doküman yükle
export const uploadDocument = async (userId, file, documentData) => {
  try {
    console.log('📤 Firebase\'e yükleme başladı:', {
      fileName: file.name,
      fileSize: file.size,
      userId: userId,
      documentData: documentData
    })
    
    // Dosyayı Firebase Storage'a yükle
    const storageRef = ref(storage, `documents/${userId}/${Date.now()}_${file.name}`)
    console.log('📤 Storage\'a yükleniyor...', storageRef.fullPath)
    
    try {
      await uploadBytes(storageRef, file)
      console.log('✅ Storage\'a yüklendi')
    } catch (storageError) {
      console.error('❌ Storage yükleme hatası:', storageError)
      throw new Error(`Storage yükleme hatası: ${storageError.code} - ${storageError.message}`)
    }
    
    let fileUrl
    try {
      fileUrl = await getDownloadURL(storageRef)
      console.log('✅ Download URL alındı:', fileUrl.substring(0, 50) + '...')
    } catch (urlError) {
      console.error('❌ URL alma hatası:', urlError)
      throw new Error(`URL alma hatası: ${urlError.message}`)
    }

    // Firestore'da doküman bilgilerini kaydet
    console.log('📝 Firestore\'a kaydediliyor...')
    
    // Text alanını kısalt (Firestore limit: 1MB per field, güvenli limit: 500KB)
    const maxTextLength = 500000 // 500KB
    const textContent = (documentData.text || '').substring(0, maxTextLength)
    
    const firestoreData = {
      userId: userId,
      filename: file.name,
      fileUrl: fileUrl,
      filepath: storageRef.fullPath,
      type: documentData.type || file.name.split('.').pop().toUpperCase(),
      text: textContent,
      summary: (documentData.summary || '').substring(0, 10000), // Summary limit: 10KB
      keywords: Array.isArray(documentData.keywords) ? documentData.keywords.slice(0, 50) : [], // Max 50 keywords
      uploadedAt: Timestamp.now()
    }
    
    // documentData'dan ekstra alanları ekle (id hariç)
    if (documentData.id) {
      firestoreData.backendId = documentData.id // Backend ID'yi ayrı bir alan olarak sakla
    }
    
    console.log('📝 Firestore verisi hazır:', {
      userId: firestoreData.userId,
      filename: firestoreData.filename,
      type: firestoreData.type,
      textLength: firestoreData.text.length,
      summaryLength: firestoreData.summary.length,
      keywordsCount: firestoreData.keywords.length
    })
    
    try {
      const docRef = await addDoc(collection(db, 'documents'), firestoreData)
      console.log('✅ Firestore\'a kaydedildi:', docRef.id)
      
      return {
        id: docRef.id,
        ...documentData,
        filename: file.name,
        uploadedAt: new Date().toISOString()
      }
    } catch (firestoreError) {
      console.error('❌ Firestore kayıt hatası:', firestoreError)
      console.error('Firestore error code:', firestoreError.code)
      console.error('Firestore error message:', firestoreError.message)
      
      // Daha açıklayıcı hata mesajı
      if (firestoreError.code === 'permission-denied') {
        throw new Error('Firestore izin hatası: Güvenlik kurallarını kontrol edin')
      } else if (firestoreError.code === 'invalid-argument') {
        throw new Error('Firestore veri hatası: Veri formatı geçersiz')
      } else {
        throw new Error(`Firestore kayıt hatası: ${firestoreError.code} - ${firestoreError.message}`)
      }
    }
  } catch (error) {
    console.error('❌ Document upload error:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })
    throw error // Orijinal hatayı fırlat
  }
}

// Kullanıcının tüm dokümanlarını getir
export const getUserDocuments = async (userId, folderId = null) => {
  try {
    console.log('📂 getUserDocuments çağrıldı:', { userId, folderId, folderIdType: typeof folderId })
    
    let q
    if (folderId) {
      // Belirli bir klasördeki dokümanları getir
      // folderId'yi string'e çevir (Firestore'da string olarak saklanıyor olabilir)
      const folderIdString = String(folderId)
      console.log('🔍 Klasördeki dokümanlar aranıyor, folderId:', folderIdString)
      q = query(
        collection(db, 'documents'),
        where('userId', '==', userId),
        where('folderId', '==', folderIdString),
        orderBy('uploadedAt', 'desc')
      )
    } else {
      // Root klasördeki dokümanları getir (folderId null veya yok)
      console.log('🔍 Root klasördeki dokümanlar aranıyor')
      q = query(
        collection(db, 'documents'),
        where('userId', '==', userId),
        orderBy('uploadedAt', 'desc')
      )
    }
    
    const querySnapshot = await getDocs(q)
    const allDocuments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      _id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate().toISOString() || new Date().toISOString()
    }))
    
    console.log('📄 Tüm dokümanlar (filtrelemeden önce):', allDocuments.map(doc => ({
      filename: doc.filename,
      folderId: doc.folderId,
      folderIdType: typeof doc.folderId
    })))
    
    // Silinmemiş dokümanları filtrele (isDeleted false veya yok)
    const notDeleted = allDocuments.filter(doc => !doc.isDeleted || doc.isDeleted === false)
    
    // Eğer folderId null ise, sadece folderId null olanları veya alanı olmayanları filtrele
    if (!folderId) {
      const filtered = notDeleted.filter(doc => !doc.folderId || doc.folderId === null || doc.folderId === '')
      console.log('📄 Root klasördeki dokümanlar (filtrelemeden sonra):', filtered.length)
      return filtered
    }
    
    // folderId varsa, string karşılaştırması yap
    const folderIdString = String(folderId)
    const filtered = notDeleted.filter(doc => {
      const docFolderId = doc.folderId
      const matches = docFolderId === folderId || String(docFolderId) === folderIdString
      if (!matches) {
        console.log('❌ Eşleşmeyen doküman:', {
          filename: doc.filename,
          docFolderId: docFolderId,
          docFolderIdType: typeof docFolderId,
          searchFolderId: folderId,
          searchFolderIdType: typeof folderId,
          searchFolderIdString: folderIdString
        })
      }
      return matches
    })
    
    console.log('📄 Klasördeki dokümanlar (filtrelemeden sonra):', filtered.length)
    return filtered
  } catch (error) {
    console.error('Get documents error:', error)
    // Eğer orderBy hatası varsa (index eksik), orderBy olmadan dene
    try {
      let q
      if (folderId) {
        const folderIdString = String(folderId)
        q = query(
          collection(db, 'documents'),
          where('userId', '==', userId),
          where('folderId', '==', folderIdString)
        )
      } else {
        q = query(
          collection(db, 'documents'),
          where('userId', '==', userId)
        )
      }
      
      const querySnapshot = await getDocs(q)
      const allDocuments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        _id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate().toISOString() || new Date().toISOString()
      }))
      
      // Manuel sıralama
      allDocuments.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      
      // Silinmemiş dokümanları filtrele (isDeleted false veya yok)
      const notDeleted = allDocuments.filter(doc => !doc.isDeleted || doc.isDeleted === false)
      
      // Eğer folderId null ise, sadece folderId null olanları filtrele
      if (!folderId) {
        return notDeleted.filter(doc => !doc.folderId || doc.folderId === null || doc.folderId === '')
      }
      
      // folderId varsa, string karşılaştırması yap
      const folderIdString = String(folderId)
      return notDeleted.filter(doc => {
        const docFolderId = doc.folderId
        return docFolderId === folderId || String(docFolderId) === folderIdString
      })
    } catch (fallbackError) {
      console.error('Get documents fallback error:', fallbackError)
      throw new Error('Dokümanlar yüklenirken hata oluştu')
    }
  }
}

// Doküman ara
export const searchDocuments = async (userId, searchQuery) => {
  try {
    const allDocs = await getUserDocuments(userId)
    const queryLower = searchQuery.toLowerCase()
    
    return allDocs.filter(doc => {
      const text = (doc.text || '').toLowerCase()
      const summary = (doc.summary || '').toLowerCase()
      const filename = (doc.filename || '').toLowerCase()
      
      return text.includes(queryLower) || 
             summary.includes(queryLower) || 
             filename.includes(queryLower) ||
             (doc.keywords && doc.keywords.some(k => k.toLowerCase().includes(queryLower)))
    })
  } catch (error) {
    console.error('Search error:', error)
    throw new Error('Arama sırasında hata oluştu')
  }
}

// Doküman özeti güncelle
export const updateDocumentSummary = async (docId, summary) => {
  try {
    const docRef = doc(db, 'documents', docId)
    await updateDoc(docRef, {
      summary: summary.shortSummary || summary,
      detailedSummary: summary.detailedSummary || summary,
      updatedAt: Timestamp.now()
    })
    return true
  } catch (error) {
    console.error('Update summary error:', error)
    throw new Error('Özet güncellenirken hata oluştu')
  }
}

// Doküman sil
export const deleteDocument = async (docId, filepath) => {
  try {
    // Firestore'dan sil
    await deleteDoc(doc(db, 'documents', docId))
    
    // Storage'dan sil (eğer filepath varsa)
    if (filepath) {
      const storageRef = ref(storage, filepath)
      await deleteObject(storageRef)
    }
    
    return true
  } catch (error) {
    console.error('Delete document error:', error)
    throw new Error('Doküman silinirken hata oluştu')
  }
}

// Klasör oluştur
export const createFolder = async (userId, folderName, parentFolderId = null) => {
  try {
    const folderData = {
      userId: userId,
      name: folderName,
      parentFolderId: parentFolderId,
      documentCount: 0,
      createdAt: Timestamp.now(),
      type: 'FOLDER'
    }

    const docRef = await addDoc(collection(db, 'folders'), folderData)
    return {
      id: docRef.id,
      ...folderData,
      createdAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Create folder error:', error)
    throw new Error('Klasör oluşturulurken hata oluştu')
  }
}

// Çöp kutusundaki dokümanları getir
export const getTrashDocuments = async (userId) => {
  try {
    const q = query(
      collection(db, 'documents'),
      where('userId', '==', userId),
      where('isDeleted', '==', true),
      orderBy('deletedAt', 'desc')
    )
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      _id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate().toISOString() || new Date().toISOString(),
      deletedAt: doc.data().deletedAt?.toDate().toISOString() || new Date().toISOString()
    }))
  } catch (error) {
    console.error('Get trash documents error:', error)
    // Eğer orderBy hatası varsa, orderBy olmadan dene
    try {
      const q = query(
        collection(db, 'documents'),
        where('userId', '==', userId),
        where('isDeleted', '==', true)
      )
      
      const querySnapshot = await getDocs(q)
      const allDocuments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        _id: doc.id,
        ...doc.data(),
        uploadedAt: doc.data().uploadedAt?.toDate().toISOString() || new Date().toISOString(),
        deletedAt: doc.data().deletedAt?.toDate().toISOString() || new Date().toISOString()
      }))
      
      // Manuel sıralama
      allDocuments.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
      return allDocuments
    } catch (fallbackError) {
      console.error('Get trash documents fallback error:', fallbackError)
      return []
    }
  }
}

// Kullanıcının klasörlerini getir
export const getUserFolders = async (userId, parentFolderId = null) => {
  try {
    let q
    if (parentFolderId) {
      q = query(
        collection(db, 'folders'),
        where('userId', '==', userId),
        where('parentFolderId', '==', parentFolderId),
        orderBy('createdAt', 'desc')
      )
    } else {
      // Firestore'da null kontrolü için tüm klasörleri al ve filtrele
      q = query(
        collection(db, 'folders'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      )
    }
    
    const querySnapshot = await getDocs(q)
    const allFolders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
    }))
    
    // Eğer parentFolderId null ise, sadece parentFolderId null olanları veya alanı olmayanları filtrele
    if (!parentFolderId) {
      return allFolders.filter(folder => !folder.parentFolderId || folder.parentFolderId === null)
    }
    
    return allFolders
  } catch (error) {
    console.error('Get folders error:', error)
    // Eğer orderBy hatası varsa (index eksik), orderBy olmadan dene
    try {
      let q
      if (parentFolderId) {
        q = query(
          collection(db, 'folders'),
          where('userId', '==', userId),
          where('parentFolderId', '==', parentFolderId)
        )
      } else {
        q = query(
          collection(db, 'folders'),
          where('userId', '==', userId)
        )
      }
      
      const querySnapshot = await getDocs(q)
      const allFolders = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }))
      
      // Manuel sıralama
      allFolders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      if (!parentFolderId) {
        return allFolders.filter(folder => !folder.parentFolderId || folder.parentFolderId === null)
      }
      
      return allFolders
    } catch (fallbackError) {
      console.error('Get folders fallback error:', fallbackError)
      return []
    }
  }
}

// Klasör sil
export const deleteFolder = async (folderId) => {
  try {
    await deleteDoc(doc(db, 'folders', folderId))
    return true
  } catch (error) {
    console.error('Delete folder error:', error)
    throw new Error('Klasör silinirken hata oluştu')
  }
}

// Tek bir doküman getir
export const getDocument = async (docId) => {
  try {
    const docRef = doc(db, 'documents', docId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        _id: docSnap.id,
        ...docSnap.data(),
        uploadedAt: docSnap.data().uploadedAt?.toDate().toISOString() || new Date().toISOString()
      }
    } else {
      throw new Error('Doküman bulunamadı')
    }
  } catch (error) {
    console.error('Get document error:', error)
    throw new Error('Doküman yüklenirken hata oluştu')
  }
}

// Tek bir klasör getir
export const getFolder = async (folderId) => {
  try {
    const folderRef = doc(db, 'folders', folderId)
    const folderSnap = await getDoc(folderRef)
    
    if (folderSnap.exists()) {
      return {
        id: folderSnap.id,
        ...folderSnap.data(),
        createdAt: folderSnap.data().createdAt?.toDate().toISOString() || new Date().toISOString()
      }
    } else {
      return null
    }
  } catch (error) {
    console.error('Get folder error:', error)
    return null
  }
}

// Doküman adını güncelle
export const updateDocumentFilename = async (docId, newFilename) => {
  try {
    const docRef = doc(db, 'documents', docId)
    await updateDoc(docRef, {
      filename: newFilename,
      updatedAt: Timestamp.now()
    })
    return true
  } catch (error) {
    console.error('Update filename error:', error)
    throw new Error('Doküman adı güncellenirken hata oluştu')
  }
}

// Dokümanı çöp kutusuna taşı (isDeleted flag'i ekle)
export const moveDocumentToTrash = async (docId) => {
  try {
    const docRef = doc(db, 'documents', docId)
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return true
  } catch (error) {
    console.error('Move to trash error:', error)
    throw new Error('Doküman çöp kutusuna taşınırken hata oluştu')
  }
}

// Dokümanı çöp kutusundan geri al
export const restoreDocumentFromTrash = async (docId) => {
  try {
    const docRef = doc(db, 'documents', docId)
    await updateDoc(docRef, {
      isDeleted: false,
      deletedAt: null,
      updatedAt: Timestamp.now()
    })
    return true
  } catch (error) {
    console.error('Restore from trash error:', error)
    throw new Error('Doküman geri alınırken hata oluştu')
  }
}

