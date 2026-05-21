import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, 
  ChevronLeft, 
  Plus, 
  Image as ImageIcon, 
  Trash2, 
  ShieldCheck,
  Eye,
  EyeOff,
  Download,
  X,
  AlertTriangle,
  Delete,
  Fingerprint
} from "lucide-react";
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../store";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";
import { encryptData, decryptData } from "../utils/e2ee";
import { compressImage } from "../utils/imageUtils";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";

function CustomSlide({ slide, ...props }: any) {
  const [decryptedUrl, setDecryptedUrl] = useState("");
  useEffect(() => {
    let active = true;
    if (slide.photo.url.startsWith("E2EE:")) {
      decryptData(slide.photo.url).then((url) => {
        if (active) setDecryptedUrl(url);
      });
    } else {
      setDecryptedUrl(slide.photo.url);
    }
    return () => { active = false; };
  }, [slide.photo.url]);

  if (!decryptedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-auto">
      <TransformWrapper 
        initialScale={1}
        minScale={1}
        maxScale={8}
        doubleClick={{ mode: "zoomIn" }}
        panning={{ velocityDisabled: true }}
      >
        {({ scale }) => (
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyItems: "center" }}
            contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <img 
              src={decryptedUrl} 
              alt="Vault item" 
              className="max-w-[100vw] max-h-[100vh] object-contain cursor-grab active:cursor-grabbing" 
              onPointerDown={(e) => {
                 if (scale > 1) {
                   e.stopPropagation();
                 }
              }}
              draggable={false}
              {...props} 
            />
          </TransformComponent>
        )}
      </TransformWrapper>
    </div>
  );
}


interface VaultPhoto {
  id: string;
  url: string;
  caption?: string;
  timestamp: any;
  source: 'chat' | 'timeline' | 'vault';
}

function PhotoCard({ photo, onDelete, onSelect, isConfirmingDelete }: { photo: VaultPhoto, onDelete?: () => void, onSelect: (photo: VaultPhoto) => void, isConfirmingDelete?: boolean }) {
  const [decryptedUrl, setDecryptedUrl] = useState("");
  const [decryptedCaption, setDecryptedCaption] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const attempt = async () => {
      if (photo.url.startsWith('E2EE:')) {
        const u = await decryptData(photo.url);
        if (active) setDecryptedUrl(u);
      } else {
        if (active) setDecryptedUrl(photo.url);
      }
      
      if (photo.caption && photo.caption.startsWith('E2EE:')) {
        const c = await decryptData(photo.caption);
        if (active) setDecryptedCaption(c);
      } else {
        if (active) setDecryptedCaption(photo.caption || "");
      }
    };
    attempt();
    window.addEventListener('e2ee-ready', attempt);
    return () => { 
      active = false; 
      window.removeEventListener('e2ee-ready', attempt);
    };
  }, [photo.url, photo.caption]);

  if (!decryptedUrl) return (
    <div className="aspect-square bg-card/40 animate-pulse" />
  );

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onSelect(photo)}
      className="group relative aspect-[4/5] bg-card/10 overflow-hidden cursor-pointer active:scale-[0.96] transition-transform rounded-2xl border border-border/40 shadow-sm"
    >
      <img 
        src={decryptedUrl} 
        alt="Vault content"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-all duration-700",
          isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-110",
          "group-hover:scale-110 group-hover:rotate-1"
        )}
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 pointer-events-none">
        <p className="text-[11px] text-white/90 font-medium line-clamp-2 shadow-sm font-sans tracking-wide">
          {decryptedCaption || (photo.source === 'chat' ? 'From Chat' : photo.source === 'timeline' ? 'From Scrapbook' : 'Private Vault')}
        </p>
      </div>

      <div className="absolute top-3 right-3 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-lg">
            <ShieldCheck size={14} className="text-emerald-400" />
        </div>
      </div>
    </motion.div>
  );
}

export function VaultScreen() {
  const { setView, roomId, user } = useAppStore();
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [error, setError] = useState(false);

  const [chatPhotos, setChatPhotos] = useState<VaultPhoto[]>([]);
  const [timelinePhotos, setTimelinePhotos] = useState<VaultPhoto[]>([]);
  const [vaultPhotos, setVaultPhotos] = useState<VaultPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedPhoto, setSelectedPhoto] = useState<VaultPhoto | null>(null);
  const [decryptedSelectedUrl, setDecryptedSelectedUrl] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const correctPassword = "101024";

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      sensory.tap();
      if (newPin.length === 6) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    sensory.tap();
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === correctPassword) {
      setIsUnlocked(true);
      setError(false);
      setPin("");
      sensory.play("success");
    } else {
      setError(true);
      sensory.play("urgent");
      setTimeout(() => {
        setError(false);
        setPin("");
      }, 600);
    }
  };

  useEffect(() => {
    if (!isUnlocked || !roomId) return;

    // 1. Fetch Chat Photos
    const chatQuery = query(
      collection(db, "pairs", roomId, "chatMessages"),
      orderBy("timestamp", "desc")
    );
    const unsubChat = onSnapshot(chatQuery, (snapshot) => {
      const photos = snapshot.docs
        .filter(doc => doc.data().image && !doc.data().isSticker)
        .map(doc => ({
          id: doc.id,
          url: doc.data().image,
          timestamp: doc.data().timestamp?.toMillis(),
          source: 'chat' as const
        }));
      setChatPhotos(photos);
    });

    // 2. Fetch Timeline Photos
    const timelineQuery = query(
      collection(db, "pairs", roomId, "timeline"),
      orderBy("date", "desc")
    );
    const unsubTimeline = onSnapshot(timelineQuery, (snapshot) => {
      const photos = snapshot.docs
        .filter(doc => doc.data().type === "photo")
        .map(doc => ({
          id: doc.id,
          url: doc.data().content,
          caption: doc.data().caption,
          timestamp: doc.data().createdAt?.toMillis(),
          source: 'timeline' as const
        }));
      setTimelinePhotos(photos);
    });

    // 3. Fetch Vault Private Photos
    const vaultQuery = query(
      collection(db, "pairs", roomId, "vaultPhotos"),
      orderBy("createdAt", "desc")
    );
    const unsubVault = onSnapshot(vaultQuery, (snapshot) => {
      const photos = snapshot.docs.map(doc => ({
        id: doc.id,
        url: doc.data().url,
        caption: doc.data().caption,
        timestamp: doc.data().createdAt?.toMillis(),
        source: 'vault' as const
      }));
      setVaultPhotos(photos);
    });

    return () => {
      unsubChat();
      unsubTimeline();
      unsubVault();
    };
  }, [isUnlocked, roomId]);

  useEffect(() => {
    if (selectedPhoto) {
      decryptData(selectedPhoto.url).then(setDecryptedSelectedUrl);
    } else {
      setDecryptedSelectedUrl("");
    }
  }, [selectedPhoto]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !roomId) return;

      setIsUploading(true);
      const fileArray = Array.from(files);
      
      let successCount = 0;
      let failCount = 0;

      try {
          for (const file of fileArray) {
              const rawDataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
              });

              const compressed = await compressImage(rawDataUrl, 600, 0.5);
              const encrypted = await encryptData(compressed);
              
              if (encrypted.length > 900000) {
                  failCount++;
                  continue;
              }

              await addDoc(collection(db, "pairs", roomId, "vaultPhotos"), {
                  url: encrypted,
                  createdAt: serverTimestamp(),
                  createdBy: user?.uid,
                  source: 'vault'
              });
              successCount++;
              sensory.play("pop");
          }

          if (failCount > 0) {
              alert(`Uploaded ${successCount} photos. ${failCount} photos were too large and could not be saved to the secure vault.`);
          }
      } catch (err) {
          console.error("Vault upload failed", err);
          alert("Something went wrong while uploading. Please try one photo at a time.");
      } finally {
          setIsUploading(false);
          e.target.value = '';
      }
  };

  const allPhotos = useMemo(() => {
    const combined = [...vaultPhotos, ...timelinePhotos, ...chatPhotos];
    return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [chatPhotos, timelinePhotos, vaultPhotos]);

  const groupedPhotos = useMemo(() => {
    const groups: { [key: string]: VaultPhoto[] } = {};
    allPhotos.forEach(photo => {
      let dateLabel = "Unknown Date";
      if (photo.timestamp) {
        const date = new Date(photo.timestamp);
        dateLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      }
      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(photo);
    });
    // the keys are already roughly ordered by our flat array because it came sorted by timestamp desc
    return Object.entries(groups);
  }, [allPhotos]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (photo: VaultPhoto) => {
      if (confirmDeleteId !== photo.id) {
          setConfirmDeleteId(photo.id);
          setTimeout(() => setConfirmDeleteId(null), 3000);
          return;
      }

      setIsDeleting(true);
      try {
          if (photo.source === 'vault') {
              await deleteDoc(doc(db, "pairs", roomId!, "vaultPhotos", photo.id));
          } else if (photo.source === 'chat') {
              await deleteDoc(doc(db, "pairs", roomId!, "chatMessages", photo.id));
          } else if (photo.source === 'timeline') {
              await deleteDoc(doc(db, "pairs", roomId!, "timeline", photo.id));
          }
          sensory.play("pop");
          setSelectedPhoto(null);
      } catch (err) {
          console.error("Delete failed", err);
      } finally {
          setIsDeleting(false);
          setConfirmDeleteId(null);
      }
  };

  const handleDownload = async () => {
    if (!decryptedSelectedUrl) return;

    try {
      if (Capacitor.isNativePlatform()) {
        const base64Data = decryptedSelectedUrl.split(",")[1];
        if (!base64Data) {
          alert("Could not process image for download.");
          return;
        }

        await Filesystem.writeFile({
          path: `vault-photo-${Date.now()}.jpg`,
          data: base64Data,
          directory: Directory.Documents,
        });
        alert("Image saved to Documents folder!");
      } else {
        const link = document.createElement("a");
        link.href = decryptedSelectedUrl;
        link.download = `vault-photo-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      sensory.play("success");
    } catch (e) {
      console.error("Download failed", e);
      alert("Failed to download image.");
    }
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-between p-8 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-from)_0%,_transparent_50%)] from-primary/10">
        
        <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full pt-12 flex justify-between items-center"
        >
          <button 
            onClick={() => setView("home")}
            className="p-3 bg-card/40 rounded-full active:scale-90 transition-all border border-border/50 text-text/60"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Encrypted Lock</span>
          </div>
          <div className="w-12 h-12" /> {/* Spacer */}
        </motion.div>

        <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full flex-1 flex flex-col items-center justify-center max-w-sm"
        >
          <div className="w-20 h-20 bg-card rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl border border-border/60 relative overflow-hidden">
            <Lock size={32} className="text-primary z-10" />
            <div className="absolute inset-0 bg-primary/10 animate-pulse" />
          </div>
          
          <h1 className="text-2xl font-bold text-text mb-2 tracking-tight">Enter Passcode</h1>
          <p className="text-sm text-text/40 mb-12">Passcode is required to access the vault.</p>

          <div className={cn("flex items-center gap-4 mb-16", error && "animate-shake")}>
            {[...Array(6)].map((_, i) => (
              <div 
                key={i}
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all duration-300",
                  pin.length > i 
                    ? "bg-primary border-primary scale-110" 
                    : "border-border/60 bg-transparent scale-100",
                  error && "border-rose-500 bg-rose-500"
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-x-8 gap-y-6 w-full max-w-[280px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num.toString())}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-3xl font-light text-text hover:bg-card active:bg-card/60 active:scale-90 transition-all font-mono"
              >
                {num}
              </button>
            ))}
            
            <div className="w-[72px] h-[72px] flex items-center justify-center">
              <Fingerprint size={32} className="text-primary/40" />
            </div>

            <button
                onClick={() => handleKeypadPress('0')}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-3xl font-light text-text hover:bg-card active:bg-card/60 active:scale-90 transition-all font-mono"
            >
              0
            </button>
            
            <button
                onClick={handleBackspace}
                disabled={pin.length === 0}
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-text/60 disabled:opacity-30 hover:bg-card active:bg-card/60 active:scale-90 transition-all"
            >
              <Delete size={28} />
            </button>
          </div>
        </motion.div>
        
        <style>{`
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-15px); }
                75% { transform: translateX(15px); }
            }
            .animate-shake { animation: shake 0.3s ease-in-out; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-bg/90 backdrop-blur-2xl px-4 py-3 flex items-center justify-between border-b border-border/30">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setView("home")}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-card/40 hover:bg-card/80 active:scale-90 transition-all text-text/80 shadow-sm border border-border/60"
                >
                    <ChevronLeft size={22} />
                </button>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-text flex items-center gap-2">
                    Private Vault
                    <ShieldCheck size={16} className="text-emerald-500" />
                  </h2>
                  <p className="text-[10px] font-bold text-text/40 uppercase tracking-widest">{allPhotos.length} Secured Items</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <label 
                    htmlFor="vault-upload-header"
                    className="h-10 px-4 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center cursor-pointer hover:bg-primary/20 active:scale-95 transition-all border border-primary/20"
                >
                    {isUploading ? (
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    ) : (
                        <><Plus size={16} className="mr-1.5"/> Add</>
                    )}
                </label>
                <input id="vault-upload-header" type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </div>
        </div>

        {/* Grid */}
        <div className="flex-1 pb-24">
            {allPhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center px-8 h-[70vh]">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-primary/10 to-transparent flex items-center justify-center mb-8 relative border border-primary/10 shadow-2xl shadow-primary/5">
                        <Lock size={40} className="text-primary/60" />
                        <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-bold text-text mb-3 tracking-tight">Your Vault is Empty</h3>
                    <p className="text-sm text-text/50 mb-10 max-w-[260px] mx-auto leading-relaxed">
                        Encrypt and preserve your most private memories away from your main gallery.
                    </p>
                    
                    <label 
                        htmlFor="vault-upload-empty"
                        className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-primary/20 cursor-pointer active:scale-95 transition-all hover:bg-primary/90"
                    >
                        <Plus size={20} />
                        Choose Photos
                        <input id="vault-upload-empty" type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                    </label>
                </div>
            ) : (
                <div className="space-y-8 pt-6 pb-6">
                    {groupedPhotos.map(([dateString, photos]) => (
                        <div key={dateString}>
                            <h3 className="px-6 mb-4 text-[13px] font-bold tracking-widest uppercase text-text/50 sticky top-[72px] z-40 bg-bg/90 backdrop-blur-3xl py-3 border-y border-border/20">{dateString}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-4">
                                {photos.map((photo) => (
                                    <PhotoCard 
                                      key={`${photo.source}-${photo.id}`} 
                                      photo={photo} 
                                      onSelect={setSelectedPhoto}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Advanced Gallery Lightbox */}
        <Lightbox
          open={!!selectedPhoto}
          index={selectedPhoto ? allPhotos.findIndex(p => p.id === selectedPhoto.id) : -1}
          close={() => setSelectedPhoto(null)}
          slides={allPhotos.map(p => ({ 
             type: "custom-photo", 
             photo: p,
             title: p.timestamp ? new Date(p.timestamp).toLocaleString() : 'Just now',
             description: p.caption || (p.source === 'chat' ? 'From Chat' : p.source === 'timeline' ? 'From Scrapbook' : '')
          }))}
          plugins={[Captions]}
          captions={{ descriptionTextAlign: 'center' }}
          carousel={{ finite: true }}
          animation={{ swipe: 250 }}
          on={{
             view: ({ index }) => setSelectedPhoto(allPhotos[index])
          }}
          render={{
            slide: ({ slide }) => (slide.type === "custom-photo" ? <CustomSlide slide={slide} /> : null),
            buttonPrev: allPhotos.length <= 1 ? () => null : undefined,
            buttonNext: allPhotos.length <= 1 ? () => null : undefined,
            iconClose: () => <X size={24} />,
          }}
          toolbar={{
            buttons: [
              <button 
                  key="back"
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 ml-2 mr-auto text-white flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
              >
                 <ChevronLeft size={28} />
              </button>,
              <button 
                  key="download"
                  onClick={handleDownload}
                  disabled={!decryptedSelectedUrl}
                  className="p-2 text-white/70 hover:text-white transition-colors disabled:opacity-30"
                  title="Download"
              >
                  <Download size={22} />
              </button>,
              <button 
                  key="delete"
                  onClick={() => selectedPhoto && handleDelete(selectedPhoto)}
                  disabled={isDeleting}
                  className="p-2 mr-2 text-rose-400 hover:text-rose-500 transition-colors disabled:opacity-30"
                  title="Delete"
              >
                  {isDeleting ? (
                     <div className="w-5 h-5 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin mx-auto" />
                  ) : confirmDeleteId === selectedPhoto?.id ? (
                     <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 bg-rose-500/20 px-2 py-1 rounded-md">Sure?</span>
                  ) : (
                     <Trash2 size={22} />
                  )}
              </button>
            ]
          }}
        />

        {/* Floating Action Button for mobile prominence */}
        {allPhotos.length > 0 && (
            <div className="fixed bottom-8 right-6 z-[60]">
                <label 
                    htmlFor="vault-upload-fab"
                    className="w-16 h-16 rounded-[2rem] bg-primary text-white flex items-center justify-center shadow-2xl shadow-primary/40 cursor-pointer active:scale-90 transition-all border-4 border-bg"
                >
                    {isUploading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Plus size={32} />
                    )}
                    <input id="vault-upload-fab" type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                </label>
            </div>
        )}

        {/* Footer Note and Storage Info */}
        <div className="p-8 text-center bg-card/10 mt-auto">
            <div className="flex flex-col items-center gap-4 max-w-[280px] mx-auto">
                <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                        <Lock size={12} className="text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-text">Private Storage</span>
                    </div>
                </div>
                
                <div className="p-5 bg-card/60 backdrop-blur-md rounded-3xl border border-border/50 text-[10px] text-text/60 leading-relaxed space-y-3">
                    <p>
                        ☁️ <span className="font-bold">Cloud Stored:</span> These photos are kept in our secure database, not on your device storage. They won't take space on your phone!
                    </p>
                    <div className="h-[1px] bg-border/30 w-full" />
                    <p>
                        🔒 <span className="font-bold">Privacy:</span> All items are <span className="text-primary font-bold">End-to-End Encrypted</span>. Even we cannot see what you upload.
                    </p>
                </div>

                <p className="text-[9px] text-text/30 italic">
                    Tip: Use free services like Google Drive or Photos to backup large albums, then link them here!
                </p>
            </div>
        </div>
    </div>
  );
}
