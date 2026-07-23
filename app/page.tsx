"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Lock, LogOut, Plus, Trash2, Key, X, 
  Download, Unlock, CheckSquare, Square, Archive, Check, ZoomIn, FolderPlus,
  Eye, EyeOff, Mail, ArrowLeft, ChevronDown, HelpCircle
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { toast } from "sonner";

// Inizializza Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface CourseSection {
  name: string;
  photos: string[];
}

interface EventSection {
  eventName: string;
  description?: string;
  courses: CourseSection[];
}

interface Student {
  id: string;
  initials: string;
  name: string;
  surname: string;
  number: string;
  email?: string;
  password: string;
  has_changed_password?: boolean;
  events: EventSection[];
}

// Helper per caricare le immagini per il Canvas
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossibile caricare l'immagine da: ${src}`));
    img.src = src;
  });
};

// Funzione applicazione Watermark
const applyWatermark = async (file: File, logoPath: string = "/logo.png"): Promise<Blob> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const [img, logo] = await Promise.all([
      loadImage(objectUrl),
      loadImage(logoPath)
    ]);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossibile creare il contesto Canvas 2D");

    let imgW = img.naturalWidth || img.width;
    let imgH = img.naturalHeight || img.height;

    const MAX_DIM = 2048;
    if (imgW > MAX_DIM || imgH > MAX_DIM) {
      if (imgW > imgH) {
        imgH = Math.round((imgH * MAX_DIM) / imgW);
        imgW = MAX_DIM;
      } else {
        imgW = Math.round((imgW * MAX_DIM) / imgH);
        imgH = MAX_DIM;
      }
    }

    canvas.width = imgW;
    canvas.height = imgH;

    ctx.drawImage(img, 0, 0, imgW, imgH);

    const logoW = logo.naturalWidth || logo.width;
    const logoH = logo.naturalHeight || logo.height;
    
    const minDim = Math.min(imgW, imgH);
    const wmWidth = minDim * 0.40;
    const aspectRatio = logoH / logoW;
    const wmHeight = wmWidth * aspectRatio;

    const margin = minDim * 0.045;
    const x = imgW - wmWidth - margin;
    const y = imgH - wmHeight - margin;

    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = minDim * 0.015;

    const offsets = [
      { dx: -2, dy: -2 },
      { dx: 2, dy: -2 },
      { dx: -2, dy: 2 },
      { dx: 2, dy: 2 }
    ];

    offsets.forEach(({ dx, dy }) => {
      ctx.shadowOffsetX = dx;
      ctx.shadowOffsetY = dy;
      ctx.drawImage(logo, x, y, wmWidth, wmHeight);
    });

    ctx.shadowColor = "transparent";
    ctx.globalAlpha = 1.0;
    ctx.drawImage(logo, x, y, wmWidth, wmHeight);
    ctx.restore();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Errore durante la conversione del Canvas"));
        },
        "image/jpeg",
        0.88
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export default function Page() {
  const [authStep, setAuthStep] = useState<'login' | 'change-password' | 'dashboard' | 'forgot-password'>('login');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  const [loginName, setLoginName] = useState("");
  const [loginSurname, setLoginSurname] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  const [minimizedEvents, setMinimizedEvents] = useState<{ [key: number]: boolean }>({});
  
  const [minimizedStudents, setMinimizedStudents] = useState<{ [key: string]: boolean }>({});
  const [staffSearchQuery, setStaffSearchQuery] = useState("");

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newNome, setNewNome] = useState("");
  const [newCognome, setNewCognome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newEventoInput, setNewEventoInput] = useState("Saggio di Fine Anno 2026");
  const [newEventoDescInput, setNewEventoDescInput] = useState("");
  const [newCorsiInput, setNewCorsiInput] = useState("Pianoforte, Canto");

  const [newEventNames, setNewEventNames] = useState<{ [studentId: string]: string }>({});
  const [newEventDescriptions, setNewEventDescriptions] = useState<{ [studentId: string]: string }>({});
  const [newCourseNames, setNewCourseNames] = useState<{ [key: string]: string }>({});
  const [eventDescInputs, setEventDescInputs] = useState<{ [key: string]: string }>({});

  const fetchStudents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("students").select("*");
    if (!error && data) {
      const formattedData = data.map((st: any) => {
        const initials = st.initials || `${st.name?.[0] || ""}${st.surname?.[0] || ""}`.toUpperCase();
        let events = st.events;
        if (!events && st.courses) {
          events = [{ eventName: "Saggio Principale", description: "", courses: st.courses }];
        }
        return {
          ...st,
          initials,
          events: events || []
        };
      });

      formattedData.sort((a, b) => (a.surname || "").localeCompare(b.surname || "", "it", { sensitivity: "base" }));

      setStudents(formattedData as Student[]);

      const initialMinState: { [key: string]: boolean } = {};
      formattedData.forEach((st: any) => {
        initialMinState[st.id] = true;
      });
      setMinimizedStudents(initialMinState);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const toggleMinimizeEvent = (eIdx: number) => {
    setMinimizedEvents(prev => ({
      ...prev,
      [eIdx]: !prev[eIdx]
    }));
  };

  const toggleMinimizeStudent = (studentId: string) => {
    setMinimizedStudents(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === "nat-admin") {
      setIsAdmin(true);
      setIsModalOpen(false);
      setAdminPasswordInput("");
      setAdminPasswordError(false);
      setShowAdminPassword(false);
      toast.success("Accesso effettuato come Staff");
    } else {
      setAdminPasswordError(true);
      toast.error("Password staff non corretta");
    }
  };

  const handleStudentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .ilike('name', loginName.trim())
        .ilike('surname', loginSurname.trim())
        .eq('password', loginPassword.trim())
        .single();

      if (error || !data) {
        setLoginError("Credenziali non valide. Controlla nome, cognome e password.");
        toast.error("Credenziali non valide");
        return;
      }

      const studentData = data as any;
      const initials = studentData.initials || `${studentData.name?.[0] || ""}${studentData.surname?.[0] || ""}`.toUpperCase();
      if (!studentData.events && studentData.courses) {
        studentData.events = [{ eventName: "Saggio Principale", description: "", courses: studentData.courses }];
      }

      const formattedStudent = {
        ...studentData,
        initials,
        events: studentData.events || []
      };

      setCurrentStudent(formattedStudent as Student);
      
      if (formattedStudent.email) {
        setStudentEmailInput(formattedStudent.email);
      }

      if (formattedStudent.has_changed_password === true) {
        setAuthStep('dashboard');
        toast.success(`Benvenuto, ${formattedStudent.name}!`);
      } else {
        setAuthStep('change-password');
        toast.info("Primo accesso: configura la tua password");
      }

      setLoginPassword("");
      setShowLoginPassword(false);
    } catch {
      setLoginError("Si è verificato un errore durante l'accesso.");
      toast.error("Errore di connessione");
    }
  };

  const handlePasswordRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRecovering(true);

    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoveryEmail }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore durante l'invio.");

      toast.success("Email di recupero inviata con successo!");
    } catch (err: any) {
      toast.error(err.message || "Errore durante l'invio dell'email.");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError("Le password non coincidono.");
      toast.error("Le password non coincidono");
      return;
    }
    if (newPasswordInput.length < 6) {
      setPasswordError("La password deve essere di almeno 6 caratteri.");
      toast.error("Password troppo corta");
      return;
    }
    if (!studentEmailInput.trim()) {
      setPasswordError("Inserisci un indirizzo email valido.");
      toast.error("Inserisci un'email valida");
      return;
    }
    if (!currentStudent) return;

    try {
      const { error } = await supabase
        .from("students")
        .update({ 
          password: newPasswordInput, 
          email: studentEmailInput.trim(),
          has_changed_password: true 
        })
        .eq("id", currentStudent.id);

      if (error) throw error;

      setCurrentStudent({ 
        ...currentStudent, 
        password: newPasswordInput,
        email: studentEmailInput.trim(),
        has_changed_password: true 
      });
      setAuthStep('dashboard');
      setSelectedPhotos([]);
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setStudentEmailInput("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast.success("Password aggiornata con successo!");
    } catch {
      setPasswordError("Errore durante il salvataggio dei dati.");
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleResetStudentPassword = async (studentId: string, studentName: string, studentSurname: string) => {
    const randomNums = Math.floor(Math.random() * 900 + 100);
    const letters = "abcdefghjkmnpqrstuvwxyz"; 
    const randomLets = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    const newTempPassword = `${studentName.toLowerCase().trim()}.${studentSurname.toLowerCase().trim()}.${randomNums}${randomLets}`;

    const { error } = await supabase
      .from("students")
      .update({ 
        password: newTempPassword, 
        has_changed_password: false 
      })
      .eq("id", studentId);

    if (error) {
      toast.error(`Errore: ${error.message}`);
    } else {
      toast.success(`Password resettata: ${newTempPassword}`);
      fetchStudents();
    }
  };

  const togglePhotoSelection = (photoUrl: string) => {
    setSelectedPhotos((prev) =>
      prev.includes(photoUrl) ? prev.filter((url) => url !== photoUrl) : [...prev, photoUrl]
    );
  };

  const toggleSelectAllPhotos = (photosList: string[]) => {
    const allSelected = photosList.every((url) => selectedPhotos.includes(url));
    if (allSelected) {
      setSelectedPhotos((prev) => prev.filter((url) => !photosList.includes(url)));
    } else {
      const newSelections = Array.from(new Set([...selectedPhotos, ...photosList]));
      setSelectedPhotos(newSelections);
    }
  };

  const handleDownloadSinglePhoto = async (photoUrl: string, fileName: string) => {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Download completato");
    } catch {
      window.open(photoUrl, "_blank");
    }
  };

  const downloadZip = async (photosToDownload: string[], zipFilename: string) => {
    if (photosToDownload.length === 0) return;
    setIsZipping(true);
    toast.info("Generazione archivio ZIP in corso...");

    try {
      const zip = new JSZip();
      const folder = zip.folder("foto-saggio");

      for (let i = 0; i < photosToDownload.length; i++) {
        const url = photosToDownload[i];
        if (url.startsWith("data:")) {
          const base64Data = url.split(",")[1] || url;
          folder?.file(`foto-${i + 1}.jpg`, base64Data, { base64: true });
        } else {
          const response = await fetch(url);
          const blob = await response.blob();
          folder?.file(`foto-${i + 1}.jpg`, blob);
        }
      }

      const zipContent = await zip.generateAsync({ 
        type: "blob", 
        mimeType: "application/zip" 
      });

      const zipBlob = new Blob([zipContent], { type: "application/zip" });
      const downloadUrl = URL.createObjectURL(zipBlob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = zipFilename.endsWith(".zip") ? zipFilename : `${zipFilename}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success("Archivio ZIP scaricato con successo!");
    } catch {
      toast.error("Si è verificato un errore nel download dello ZIP.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome || !newCognome) return;

    const initials = `${newNome[0] || ""}${newCognome[0] || ""}`.toUpperCase();

    const coursesList = newCorsiInput
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .map((courseName) => ({ name: courseName, photos: [] }));

    const randomNums = Math.floor(Math.random() * 900 + 100);
    const letters = "abcdefghjkmnpqrstuvwxyz"; 
    const randomLets = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];

    const generatedPassword = `${newNome.toLowerCase().trim()}.${newCognome.toLowerCase().trim()}.${randomNums}${randomLets}`;
    
    const newStudent = {
      id: crypto.randomUUID(),
      initials,
      name: newNome.trim(),
      surname: newCognome.trim(),
      number: newNumber.trim() || "N/D",
      email: newEmail.trim() ? newEmail.trim() : null,
      password: generatedPassword,
      has_changed_password: false,
      courses: coursesList,
      events: [{ 
        eventName: newEventoInput.trim() || "Saggio Principale", 
        description: newEventoDescInput.trim(), 
        courses: coursesList 
      }]
    };

    const { error } = await supabase.from("students").insert([newStudent]);

    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }

    toast.success("Allievo creato con successo!");
    fetchStudents();
    setNewNome("");
    setNewCognome("");
    setNewEmail("");
    setNewNumber("");
    setNewEventoInput("");
    setNewEventoDescInput("");
    setNewCorsiInput("");
  };

  const handleAddEvent = async (studentId: string) => {
    const eventName = newEventNames[studentId]?.trim();
    const eventDescription = newEventDescriptions[studentId]?.trim() || "";
    if (!eventName) return;

    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const updatedEvents = [
      ...targetStudent.events,
      { eventName, description: eventDescription, courses: [{ name: "Generale", photos: [] }] }
    ];

    const { error } = await supabase
      .from("students")
      .update({ events: updatedEvents })
      .eq("id", studentId);

    if (!error) {
      setNewEventNames({ ...newEventNames, [studentId]: "" });
      setNewEventDescriptions({ ...newEventDescriptions, [studentId]: "" });
      toast.success("Evento aggiunto!");
      fetchStudents();
    } else {
      toast.error("Errore nell'aggiunta dell'evento");
    }
  };

  const handleSaveEventDescription = async (studentId: string, eventIndex: number) => {
    const key = `${studentId}-${eventIndex}`;
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const newDesc = eventDescInputs[key] !== undefined 
      ? eventDescInputs[key] 
      : (targetStudent.events[eventIndex]?.description || "");

    const updatedEvents = targetStudent.events.map((ev, eIdx) => {
      if (eIdx === eventIndex) {
        return { ...ev, description: newDesc };
      }
      return ev;
    });

    const { error } = await supabase
      .from("students")
      .update({ events: updatedEvents })
      .eq("id", studentId);

    if (!error) {
      toast.success("Descrizione aggiornata!");
      fetchStudents();
    } else {
      toast.error(`Errore: ${error.message}`);
    }
  };

  const handleDeleteEvent = async (studentId: string, eventIndex: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo intero evento?")) return;

    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const updatedEvents = targetStudent.events.filter((_, idx) => idx !== eventIndex);

    const updatePayload: any = { events: updatedEvents };
    if (updatedEvents.length > 0 && updatedEvents[0].courses) {
      updatePayload.courses = updatedEvents[0].courses;
    } else {
      updatePayload.courses = [];
    }

    const { error } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    if (error) {
      toast.error(`Errore: ${error.message}`);
    } else {
      toast.success("Evento eliminato");
      fetchStudents();
    }
  };

  const handleAddCourseToEvent = async (studentId: string, eventIndex: number) => {
    const key = `${studentId}-${eventIndex}`;
    const courseName = newCourseNames[key]?.trim();
    if (!courseName) return;

    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const updatedEvents = targetStudent.events.map((ev, eIdx) => {
      if (eIdx === eventIndex) {
        return {
          ...ev,
          courses: [...ev.courses, { name: courseName, photos: [] }]
        };
      }
      return ev;
    });

    const { error } = await supabase
      .from("students")
      .update({ events: updatedEvents })
      .eq("id", studentId);

    if (!error) {
      setNewCourseNames({ ...newCourseNames, [key]: "" });
      toast.success("Corso aggiunto!");
      fetchStudents();
    }
  };

  const handleFileUpload = async (studentId: string, eventIndex: number, courseIndex: number, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const studentFolder = `${targetStudent.name}_${targetStudent.surname}`
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_");

    const fileArray = Array.from(files);
    const uploadedUrls: string[] = [];
    toast.info("Elaborazione e watermark foto in corso...");

    for (const file of fileArray) {
      try {
        const watermarkedBlob = await applyWatermark(file, "/logo.png");
        const fileName = `${studentFolder}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

        const { error: uploadError } = await supabase.storage
          .from("foto-allievi")
          .upload(fileName, watermarkedBlob, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) continue;

        const { data: urlData } = supabase.storage
          .from("foto-allievi")
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      } catch (err) {
        console.error("Errore watermark:", err);
      }
    }

    if (uploadedUrls.length === 0) {
      toast.error("Nessuna foto caricata");
      return;
    }

    const updatedEvents = targetStudent.events.map((ev, eIdx) => {
      if (eIdx === eventIndex) {
        const updatedCourses = ev.courses.map((c, cIdx) => {
          if (cIdx === courseIndex) {
            return { ...c, photos: [...c.photos, ...uploadedUrls] };
          }
          return c;
        });
        return { ...ev, courses: updatedCourses };
      }
      return ev;
    });

    const updatePayload: any = { events: updatedEvents };
    if (updatedEvents.length > 0 && updatedEvents[0].courses) {
      updatePayload.courses = updatedEvents[0].courses;
    }

    const { error } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    if (!error) {
      toast.success("Foto caricate con successo!");
      fetchStudents();
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Eliminare definitivamente questo allievo?")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (!error) {
      toast.success("Allievo eliminato");
      fetchStudents();
    }
  };

  const handleDeletePhoto = async (studentId: string, eventIndex: number, courseIndex: number, photoIndex: number) => {
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const photoUrlToDelete = targetStudent.events[eventIndex]?.courses[courseIndex]?.photos[photoIndex];

    if (photoUrlToDelete && photoUrlToDelete.includes("/foto-allievi/")) {
      const pathParts = photoUrlToDelete.split("/foto-allievi/");
      if (pathParts[1]) {
        await supabase.storage.from("foto-allievi").remove([pathParts[1]]);
      }
    }

    const updatedEvents = targetStudent.events.map((ev, eIdx) => {
      if (eIdx === eventIndex) {
        const updatedCourses = ev.courses.map((c, cIdx) => {
          if (cIdx === courseIndex) {
            const updatedPhotos = [...c.photos];
            updatedPhotos.splice(photoIndex, 1);
            return { ...c, photos: updatedPhotos };
          }
          return c;
        });
        return { ...ev, courses: updatedCourses };
      }
      return ev;
    });

    const updatePayload: any = { events: updatedEvents };
    if (updatedEvents.length > 0 && updatedEvents[0].courses) {
      updatePayload.courses = updatedEvents[0].courses;
    }

    const { error } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    if (!error) {
      toast.success("Foto rimossa");
      fetchStudents();
    }
  };

  const getTotalPhotosCount = (student: Student) => {
    return student.events.reduce((total, ev) => 
      total + ev.courses.reduce((cTotal, c) => cTotal + c.photos.length, 0), 0
    );
  };

  const filteredStaffStudents = students.filter(st => {
    const fullName = `${st.name} ${st.surname}`.toLowerCase();
    const query = staffSearchQuery.toLowerCase();
    const emailMatch = st.email?.toLowerCase().includes(query) || false;
    return fullName.includes(query) || emailMatch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="w-48 h-12 bg-white/10 rounded-xl animate-pulse mb-8" />
        <div className="w-full max-w-md space-y-4">
          <div className="h-12 bg-white/10 rounded-xl animate-pulse" />
          <div className="h-12 bg-white/10 rounded-xl animate-pulse" />
          <div className="h-12 bg-[#c9b074]/20 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased bg-slate-950 text-slate-100 selection:bg-[#c9b074] selection:text-black relative overflow-hidden transition-colors duration-300">

      {/* Sfondi luminosi sfocati (Glow Effects) */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
        .font-playfair {
          font-family: 'Playfair Display', Georgia, serif;
        }
      `}</style>

      {/* HEADER A TRE COLONNE */}
      <header className="relative z-20 w-full px-4 sm:px-8 py-4 border-b border-[#c9b074]/20 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between gap-4">
        <div className="flex items-center justify-start flex-1">
          {!isAdmin && authStep === 'login' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.25em] uppercase text-slate-400 hover:text-white transition-all transform active:scale-95 cursor-pointer"
            >
              <Lock size={13} className="text-[#c9b074]" />
              <span className="hidden sm:inline">Area Riservata</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-center shrink-0">
          <div className="relative h-12 sm:h-16 w-auto flex items-center justify-center">
            <Image 
              src="/logo.png" 
              alt="N.A.T. Nuova Accademia Toscanini" 
              width={200} 
              height={85} 
              className="h-full w-auto object-contain drop-shadow-[0_4px_13px_rgba(201,176,116,0.15)] brightness-110"
              priority
            />
          </div>
        </div>

        <div className="flex items-center justify-end flex-1 gap-3">
          {isAdmin ? (
            <button 
              onClick={() => { setIsAdmin(false); toast.info("Uscito dall'area staff"); }}
              className="flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-medium transition-all duration-200 transform active:scale-95 cursor-pointer shadow-sm bg-white/5 hover:bg-white/10 border-white/15 text-white"
            >
              <LogOut size={14} className="text-red-400" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          ) : authStep === 'dashboard' && currentStudent ? (
            <button 
              onClick={() => { setCurrentStudent(null); setAuthStep('login'); setSelectedPhotos([]); toast.info("Sessione chiusa"); }}
              className="flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-medium transition-all duration-200 transform active:scale-95 cursor-pointer shadow-sm bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-white"
            >
              <LogOut size={14} className="text-red-400" />
              <span>Esci ({currentStudent.name})</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsFaqModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-medium transition-all duration-200 transform active:scale-95 shadow-sm bg-white/5 hover:bg-white/10 border-white/15 text-white cursor-pointer"
            >
              <HelpCircle size={14} className="text-[#c9b074]" />
              <span>FAQ / Aiuto</span>
            </button>
          )}
        </div>
      </header>

      {/* ==================== VISTA 1: PANNELLO STAFF ==================== */}
      {isAdmin ? (
        <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-5xl font-normal font-playfair text-white mb-2 leading-tight">
              Gestione Allievi
            </h1>
            <p className="text-sm sm:text-base text-slate-400 italic">
              (Pannello Staff) - Gli allievi sono ordinati automaticamente in ordine alfabetico per cognome.
            </p>
          </div>

          <div className="border border-[#c9b074]/20 rounded-3xl p-6 sm:p-8 mb-8 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300">
            <h2 className="text-3xl font-normal mb-1 font-playfair text-white">
              Aggiungi un allievo
            </h2>
            <p className="text-xs mb-6 font-light text-slate-400">
              Inserisci i dati per registrare un nuovo allievo nel sistema.
            </p>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    NOME
                  </label>
                  <input 
                    type="text" 
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Mario"
                    required
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    COGNOME
                  </label>
                  <input 
                    type="text" 
                    value={newCognome}
                    onChange={(e) => setNewCognome(e.target.value)}
                    placeholder="Rossi"
                    required
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    EMAIL (FACOLTATIVA)
                  </label>
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="mario.rossi@email.com"
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    EVENTO / SAGGIO
                  </label>
                  <input 
                    type="text" 
                    value={newEventoInput}
                    onChange={(e) => setNewEventoInput(e.target.value)}
                    placeholder="Saggio Fine Anno"
                    required
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    DESCRIZIONE EVENTO (FACOLTATIVA)
                  </label>
                  <input 
                    type="text" 
                    value={newEventoDescInput}
                    onChange={(e) => setNewEventoDescInput(e.target.value)}
                    placeholder="Es. Concerto di fine anno accademico..."
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    CORSI (SEPARATI DA VIRGOLA)
                  </label>
                  <input 
                    type="text" 
                    value={newCorsiInput}
                    onChange={(e) => setNewCorsiInput(e.target.value)}
                    placeholder="Pianoforte, Canto"
                    required
                    className="w-full border rounded-xl px-4 py-2.5 text-xs focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs py-2.5 px-6 rounded-full flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer mt-2 shadow-lg"
              >
                <Plus size={15} />
                <span>Crea allievo</span>
              </button>
            </form>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Cerca allievo per nome, cognome o email..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl backdrop-blur-xl bg-slate-900/60 border border-[#c9b074]/20 text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074] transition-colors text-sm shadow-xl"
            />
          </div>

          <div className="space-y-6">
            {filteredStaffStudents.map((student) => {
              const isStudentMinimized = minimizedStudents[student.id];

              return (
                <div key={student.id} className="border border-[#c9b074]/20 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
                  <div 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none"
                    onClick={() => toggleMinimizeStudent(student.id)}
                  >
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-normal font-playfair text-white">
                        {student.surname} {student.name}
                      </h3>
                      <div className="flex flex-col gap-1 text-xs font-mono mt-1 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Key size={13} />
                          <span>Password provvisoria: {student.password}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Mail size={13} />
                          <span>Email: {student.email || "Non ancora registrata"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleResetStudentPassword(student.id, student.name, student.surname)}
                          className="flex items-center gap-1.5 border border-[#c9b074]/40 text-[#c9b074] hover:bg-[#c9b074]/10 text-xs px-3.5 py-1.5 rounded-full transition-all transform active:scale-95 cursor-pointer"
                        >
                          <Key size={13} />
                          <span className="hidden md:inline">Rigenera Password</span>
                        </button>

                        <button 
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs px-3.5 py-1.5 rounded-full transition-all transform active:scale-95 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span className="hidden md:inline">Elimina</span>
                        </button>
                      </div>

                      <button 
                        type="button"
                        aria-label={isStudentMinimized ? "Espandi" : "Minimizza"}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors shrink-0"
                      >
                        <ChevronDown 
                          size={20} 
                          className={`transform transition-transform duration-300 text-[#c9b074] ${isStudentMinimized ? "rotate-0" : "rotate-180"}`} 
                        />
                      </button>
                    </div>
                  </div>

                  {!isStudentMinimized && (
                    <div className="mt-6 pt-6 border-t border-white/15 space-y-6 animate-fadeIn">
                      <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <input 
                            type="text"
                            placeholder="Nome nuovo evento..."
                            value={newEventNames[student.id] || ""}
                            onChange={(e) => setNewEventNames({ ...newEventNames, [student.id]: e.target.value })}
                            className="w-full sm:flex-1 border rounded-xl px-4 py-2 text-xs bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                          />
                          <button 
                            onClick={() => handleAddEvent(student.id)}
                            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
                          >
                            <FolderPlus size={14} className="text-[#c9b074]" />
                            <span>Aggiungi Evento</span>
                          </button>
                        </div>
                        <div>
                          <input 
                            type="text"
                            placeholder="Descrizione evento (facoltativa)..."
                            value={newEventDescriptions[student.id] || ""}
                            onChange={(e) => setNewEventDescriptions({ ...newEventDescriptions, [student.id]: e.target.value })}
                            className="w-full border rounded-xl px-4 py-2 text-xs bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        {student.events.map((event, eIdx) => (
                          <div key={eIdx} className="border rounded-2xl p-5 bg-black/30 border-white/15 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                              <h4 className="text-xl sm:text-2xl font-normal font-playfair text-[#c9b074]">
                                {event.eventName}
                              </h4>

                              <button 
                                onClick={() => handleDeleteEvent(student.id, eIdx)}
                                className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1 rounded-full transition-all transform active:scale-95 cursor-pointer"
                              >
                                <Trash2 size={12} />
                                <span>Elimina evento</span>
                              </button>
                            </div>

                            <div className="mb-4">
                              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-slate-400">
                                DESCRIZIONE EVENTO
                              </label>
                              <div className="flex flex-col sm:flex-row items-center gap-2">
                                <input 
                                  type="text"
                                  placeholder="Aggiungi una descrizione per questo evento..."
                                  defaultValue={event.description || ""}
                                  onChange={(e) => setEventDescInputs({ ...eventDescInputs, [`${student.id}-${eIdx}`]: e.target.value })}
                                  className="w-full sm:flex-1 border rounded-xl px-3 py-2 text-xs bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                                />
                                <button 
                                  onClick={() => handleSaveEventDescription(student.id, eIdx)}
                                  className="w-full sm:w-auto bg-[#c9b074]/20 hover:bg-[#c9b074]/30 border border-[#c9b074]/40 text-[#c9b074] text-xs px-3.5 py-2 rounded-xl transition-all transform active:scale-95 cursor-pointer font-semibold"
                                >
                                  Salva Descrizione
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
                              <input 
                                type="text"
                                placeholder="Nuovo corso..."
                                value={newCourseNames[`${student.id}-${eIdx}`] || ""}
                                onChange={(e) => setNewCourseNames({ ...newCourseNames, [`${student.id}-${eIdx}`]: e.target.value })}
                                className="w-full sm:flex-1 border rounded-xl px-3 py-1.5 text-xs bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                              />
                              <button 
                                onClick={() => handleAddCourseToEvent(student.id, eIdx)}
                                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all transform active:scale-95 cursor-pointer"
                              >
                                <Plus size={13} /> Corso
                              </button>
                            </div>

                            <div className="space-y-4">
                              {event.courses.map((course, cIdx) => (
                                <div key={cIdx} className="border rounded-xl p-4 bg-black/50 border-white/10">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-semibold text-slate-200">
                                      Corso: {course.name}
                                    </span>
                                    <span className="text-xs text-slate-400">{course.photos.length} foto</span>
                                  </div>

                                  {course.photos.length > 0 ? (
                                    <div className="flex flex-wrap gap-3 mb-3">
                                      {course.photos.map((photoUrl, pIdx) => (
                                        <div key={pIdx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/15 group bg-black cursor-pointer">
                                          <img 
                                            src={photoUrl} 
                                            alt={`Foto ${course.name}`} 
                                            onClick={() => setZoomPhotoUrl(photoUrl)}
                                            className="w-full h-full object-cover" 
                                          />
                                          <button 
                                            onClick={() => handleDeletePhoto(student.id, eIdx, cIdx, pIdx)}
                                            className="absolute top-1.5 right-1.5 bg-black/80 text-red-400 hover:text-white p-1 rounded-full opacity-80 group-hover:opacity-100 transition-opacity z-10"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs italic mb-3 text-slate-500">Nessuna foto in questo corso.</p>
                                  )}

                                  <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1 text-slate-400">
                                      CARICA FOTO (WATERMARK AUTOMATICO)
                                    </label>
                                    <input 
                                      type="file" 
                                      multiple 
                                      accept="image/*"
                                      onChange={(e) => handleFileUpload(student.id, eIdx, cIdx, e.target.files)}
                                      className="w-full text-xs cursor-pointer file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs text-slate-300 file:bg-white/10 file:text-white hover:file:bg-white/25 transition-all"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        </main>
      ) : authStep === 'change-password' && currentStudent ? (
        <main className="relative z-10 max-w-md mx-auto px-6 pt-16 pb-24">
          <div className="border border-[#c9b074]/20 rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white">
            <div className="text-center mb-6">
              <span className="text-sm font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-1">
                Primo Accesso
              </span>
              <h2 className="text-3xl font-normal font-playfair">
                Benvenuto, {currentStudent.name}!
              </h2>
              <p className="text-xs mt-2 text-slate-400 leading-relaxed">
                Imposta una password definitiva e registra la tua email personale.
              </p>
            </div>

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-xl text-xs">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                  La tua Email Personale
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={studentEmailInput} 
                    onChange={(e) => setStudentEmailInput(e.target.value)} 
                    required 
                    placeholder="nome.cognome@email.com"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 pl-10 text-xs text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                  Nuova Password Definitiva
                </label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPasswordInput} 
                    onChange={(e) => setNewPasswordInput(e.target.value)} 
                    required 
                    placeholder="Minimo 6 caratteri"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 pr-10 text-xs text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                  Conferma Nuova Password
                </label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPasswordInput} 
                    onChange={(e) => setConfirmPasswordInput(e.target.value)} 
                    required 
                    placeholder="Ripeti la password"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 pr-10 text-xs text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs py-3.5 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg mt-2 flex items-center justify-center gap-2"
              >
                <Check size={15} />
                <span>Salva e Accedi alla Galleria</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'forgot-password' ? (
        <main className="relative z-10 max-w-md mx-auto px-6 pt-16 pb-24">
          <div className="border border-[#c9b074]/20 rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white">
            <button 
              onClick={() => { setAuthStep('login'); setRecoveryEmail(""); }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Torna al login</span>
            </button>

            <div className="text-center mb-6">
              <span className="text-sm font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-1">
                Supporto Account
              </span>
              <h2 className="text-3xl font-normal font-playfair">
                Recupera Password
              </h2>
            </div>

            <form onSubmit={handlePasswordRecoverySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                  Indirizzo Email
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={recoveryEmail} 
                    onChange={(e) => setRecoveryEmail(e.target.value)} 
                    required 
                    placeholder="nome.cognome@email.com"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 pl-10 text-xs text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isRecovering}
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs py-3.5 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Mail size={15} />
                <span>{isRecovering ? "Invio in corso..." : "Invia email di recupero"}</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'dashboard' && currentStudent ? (
        <main className="relative z-10 max-w-5xl mx-auto px-6 pt-10 pb-24">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b pb-6 border-white/10">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-1 text-slate-400">
                Area Allievo
              </p>
              <h1 className="text-4xl sm:text-5xl font-normal font-playfair text-white">
                Foto di <span className="italic text-[#c9b074]">{currentStudent.name} {currentStudent.surname}</span>
              </h1>
            </div>

            <button 
              onClick={() => {
                const allPhotos = currentStudent.events.flatMap((ev) => ev.courses.flatMap((c) => c.photos));
                downloadZip(allPhotos, `saggio-${currentStudent.surname}-${currentStudent.name}`);
              }}
              disabled={isZipping || getTotalPhotosCount(currentStudent) === 0}
              className="flex items-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs px-5 py-2.5 rounded-full transition-all transform active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg"
            >
              <Archive size={15} />
              <span>{isZipping ? "Creazione ZIP..." : "Scarica TUTTO (.zip)"}</span>
            </button>
          </div>

          {selectedPhotos.length > 0 && (
            <div className="sticky top-4 z-40 backdrop-blur-xl border rounded-2xl p-4 mb-8 flex justify-between items-center shadow-2xl bg-slate-900/80 border-[#c9b074]/30 text-white animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="w-6 h-6 rounded-full bg-[#c9b074] text-black font-bold flex items-center justify-center text-[11px]">
                  {selectedPhotos.length}
                </span>
                <span>foto selezionate</span>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedPhotos([])}
                  className="text-xs transition-colors cursor-pointer text-slate-400 hover:text-white"
                >
                  Deseleziona
                </button>

                <button 
                  onClick={() => downloadZip(selectedPhotos, `foto-selezionate-${currentStudent.surname}`)}
                  disabled={isZipping}
                  className="flex items-center gap-1.5 bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs px-4 py-2 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-md"
                >
                  <Download size={14} />
                  <span>Scarica Selezionate (.zip)</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-12">
            {currentStudent.events.map((event, eIdx) => {
              const allEventPhotos = event.courses.flatMap((c) => c.photos);
              const isAllEventSelected = allEventPhotos.length > 0 && allEventPhotos.every((p) => selectedPhotos.includes(p));
              const isMinimized = minimizedEvents[eIdx];

              return (
                <div key={eIdx} className="border-2 border-[#c9b074]/30 rounded-3xl p-6 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/15">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleMinimizeEvent(eIdx)}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#c9b074] transition-all transform active:scale-95 cursor-pointer shrink-0"
                        title={isMinimized ? "Espandi evento" : "Minimizza evento"}
                      >
                        <ChevronDown size={18} className={`transition-transform duration-300 ${isMinimized ? "-rotate-90" : "rotate-0"}`} />
                      </button>

                      <div>
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#c9b074] block mb-1">
                          Evento / Spettacolo
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-normal font-playfair text-white">
                          {event.eventName}
                        </h2>
                        {event.description && (
                          <p className="text-xs sm:text-sm text-slate-300 mt-2 font-light leading-relaxed">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {allEventPhotos.length > 0 && !isMinimized && (
                      <button 
                        onClick={() => toggleSelectAllPhotos(allEventPhotos)}
                        className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-all transform active:scale-95 cursor-pointer"
                      >
                        {isAllEventSelected ? <CheckSquare size={15} className="text-[#c9b074]" /> : <Square size={15} />}
                        <span>{isAllEventSelected ? "Deseleziona intero evento" : "Seleziona tutto l'evento"}</span>
                      </button>
                    )}
                  </div>

                  {!isMinimized && (
                    <div className="space-y-8">
                      {event.courses.map((course, cIdx) => {
                        const isAllCourseSelected = course.photos.length > 0 && course.photos.every((p) => selectedPhotos.includes(p));

                        return (
                          <div key={cIdx} className="border border-[#c9b074]/20 rounded-2xl p-5 sm:p-6 bg-black/40 backdrop-blur-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-white/10">
                              <h3 className="text-2xl font-normal font-playfair flex items-center gap-3 text-white">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074]"></span>
                                Corso di {course.name}
                              </h3>

                              {course.photos.length > 0 && (
                                <button 
                                  onClick={() => toggleSelectAllPhotos(course.photos)}
                                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  {isAllCourseSelected ? <CheckSquare size={15} className="text-[#c9b074]" /> : <Square size={15} />}
                                  <span>{isAllCourseSelected ? "Deseleziona corso" : "Seleziona corso"}</span>
                                </button>
                              )}
                            </div>

                            {course.photos.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {course.photos.map((photoUrl, pIdx) => {
                                  const isSelected = selectedPhotos.includes(photoUrl);

                                  return (
                                    <div 
                                      key={pIdx} 
                                      className={`relative group rounded-xl overflow-hidden border cursor-pointer transition-all duration-300 aspect-square bg-black ${
                                        isSelected 
                                          ? "border-[#c9b074] ring-2 ring-[#c9b074]/50 scale-[1.02]" 
                                          : "border-white/15 hover:border-white/40 hover:scale-[1.01]"
                                      }`}
                                    >
                                      <img 
                                        src={photoUrl} 
                                        alt={`Foto ${course.name}`} 
                                        onClick={() => setZoomPhotoUrl(photoUrl)}
                                        className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? "scale-105 opacity-90" : "group-hover:scale-105"}`} 
                                      />

                                      <div 
                                        onClick={() => setZoomPhotoUrl(photoUrl)}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
                                      >
                                        <span className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/20 shadow-lg">
                                          <ZoomIn size={14} className="text-[#c9b074]" /> Ingrandisci
                                        </span>
                                      </div>

                                      <div 
                                        onClick={(e) => { e.stopPropagation(); togglePhotoSelection(photoUrl); }}
                                        className="absolute top-3 left-3 z-10"
                                      >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                          isSelected ? "bg-[#c9b074] text-black shadow-md scale-110" : "bg-black/60 border border-white/40 text-transparent hover:border-white"
                                        }`}>
                                          <Check size={14} className="stroke-[3]" />
                                        </div>
                                      </div>

                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadSinglePhoto(
                                            photoUrl, 
                                            `foto-${currentStudent.name}-${event.eventName}-${course.name}-${pIdx + 1}.jpg`
                                          );
                                        }}
                                        className="absolute top-3 right-3 bg-black/70 hover:bg-[#c9b074] hover:text-black text-white p-2 rounded-full transition-colors shadow-lg z-20 cursor-pointer"
                                      >
                                        <Download size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm italic text-slate-500">Nessuna foto disponibile per questo corso.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <main className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-24">
          <div className="text-center space-y-4 mb-10">
            <h1 className="text-7xl sm:text-7.5xl font-normal leading-[1.05] tracking-tight font-playfair text-white">
              Accedi alla tua <span className="italic font-normal bg-gradient-to-r from-white via-[#c9b074] to-slate-400 bg-clip-text text-transparent">Galleria Privata</span>
            </h1>
            <p className="text-xs sm:text-sm max-w-md mx-auto font-normal leading-relaxed text-slate-400">
              Inserisci le credenziali fornite dalla segreteria.
            </p>
          </div>

          <div className="border border-[#c9b074]/20 rounded-3xl p-8 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <form onSubmit={handleStudentLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-xl text-xs">
                  {loginError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    Nome
                  </label>
                  <input 
                    type="text" 
                    value={loginName} 
                    onChange={(e) => setLoginName(e.target.value)} 
                    required 
                    placeholder="es. Mario"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                    Cognome
                  </label>
                  <input 
                    type="text" 
                    value={loginSurname} 
                    onChange={(e) => setLoginSurname(e.target.value)} 
                    required 
                    placeholder="es. Rossi"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <input 
                    type={showLoginPassword ? "text" : "password"} 
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 pr-10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs py-3.5 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg mt-4 flex items-center justify-center gap-2"
              >
                <Unlock size={14} />
                <span>Accedi alla galleria</span>
              </button>

              <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-3 text-center">
                <button 
                  type="button"
                  onClick={() => setAuthStep('forgot-password')}
                  className="text-xs text-[#c9b074] hover:underline cursor-pointer font-medium"
                >
                  Hai dimenticato la password? Recuperala qui
                </button>
                <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                  Se non è ancora avvenuto il cambio password andare in segreteria per prendersi la password.
                </p>
              </div>
            </form>
          </div>
        </main>
      )}

      {/* POP-UP FAQ / GUIDA AIUTO PER I GENITORI */}
      {isFaqModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="border border-[#c9b074]/30 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl transition-colors backdrop-blur-2xl bg-slate-950/90 text-white">
            <button 
              onClick={() => setIsFaqModalOpen(false)}
              className="absolute top-5 right-5 p-1 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase mb-2 text-[#c9b074]">
                Guida e Assistenza
              </p>
              <h2 className="text-3xl font-normal font-playfair text-white">
                FAQ - <span className="italic text-[#c9b074]">Hai bisogno di aiuto?</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Tutte le risposte e le istruzioni per accedere e utilizzare la galleria fotografica.
              </p>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1.5 font-playfair flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c9b074]"></span>
                  1. Come entrare (Primo Accesso)
                </h3>
                <p>
                  Per effettuare il primo accesso, inserisci nella schermata principale il <strong>Nome</strong> e il <strong>Cognome</strong> dell'allievo insieme alla <strong>password provvisoria</strong> fornita dalla segreteria dell'accademia.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1.5 font-playfair flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c9b074]"></span>
                  2. Registrazione e configurazione account
                </h3>
                <p>
                  Al primo login il sistema richiederà di completare la configurazione inserendo un <strong>indirizzo email personale</strong> e impostando una <strong>nuova password definitiva</strong> (di almeno 6 caratteri). Questo metterà in sicurezza il profilo per gli accessi futuri.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1.5 font-playfair flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c9b074]"></span>
                  3. Cosa fare se si perde la password
                </h3>
                <p>
                  Nella schermata di accesso, clicca sul link <strong>"Hai dimenticato la password? Recuperala qui"</strong>, inserisci la tua email registrata per ricevere le istruzioni di recupero, oppure contatta direttamente la segreteria dell'accademia per un reset rapido.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-white mb-1.5 font-playfair flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c9b074]"></span>
                  4. Come accedere alla galleria e scaricare le foto
                </h3>
                <p>
                  Una volta dentro la dashboard, potrai visualizzare tutti gli spettacoli e i corsi dell'allievo. Clicca su qualsiasi foto per ingrandirla, oppure seleziona le foto desiderate (o l'intero evento) per scaricarle rapidamente in formato <strong>ZIP</strong> con un unico click.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/10 text-center">
              <button 
                onClick={() => setIsFaqModalOpen(false)}
                className="bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs py-2.5 px-6 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg"
              >
                Ho capito, chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP ZOOM */}
      {zoomPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 sm:p-8 animate-fadeIn"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div 
            className="w-full max-w-5xl flex justify-between items-center z-10 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-slate-400 font-mono tracking-wider">
              ANTEPRIMA IMMAGINE
            </div>

            <div className="flex items-center gap-3">
              {currentStudent && authStep === 'dashboard' && (
                <button 
                  onClick={() => togglePhotoSelection(zoomPhotoUrl)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all transform active:scale-95 cursor-pointer ${
                    selectedPhotos.includes(zoomPhotoUrl)
                      ? "bg-[#c9b074] text-black"
                      : "bg-slate-800 text-white hover:bg-slate-700 border border-white/10"
                  }`}
                >
                  <Check size={14} />
                  <span>{selectedPhotos.includes(zoomPhotoUrl) ? "Selezionata" : "Seleziona"}</span>
                </button>
              )}

              <button 
                onClick={() => handleDownloadSinglePhoto(zoomPhotoUrl, "foto-saggio-nat.jpg")}
                className="flex items-center gap-1.5 bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-xs px-4 py-2 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg"
              >
                <Download size={14} />
                <span>Scarica</span>
              </button>

              <button 
                onClick={() => setZoomPhotoUrl(null)}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div 
            className="relative max-w-5xl max-h-[80vh] my-auto flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-slate-900/50 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={zoomPhotoUrl} 
              alt="Anteprima foto ingrandita" 
              className="max-w-full max-h-[80vh] object-contain select-none"
            />
          </div>

          <p className="text-slate-500 text-xs italic z-10 pb-2">
            Clicca in un punto qualsiasi fuori dalla foto per chiudere
          </p>
        </div>
      )}

      {/* POP-UP LOGIN STAFF ADMIN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="border border-[#c9b074]/30 rounded-3xl p-8 max-w-sm w-full relative shadow-2xl transition-colors backdrop-blur-2xl bg-slate-950/90 text-white">
            <button 
              onClick={() => { setIsModalOpen(false); setAdminPasswordError(false); setShowAdminPassword(false); setAdminPasswordInput(""); }}
              className="absolute top-5 right-5 p-1 rounded-full transition-colors cursor-pointer text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-8">
              <p className="text-[10px] font-semibold tracking-[0.3em] uppercase mb-2 text-slate-400">
                RISERVATO ALLO STAFF
              </p>
              <h2 className="text-4xl font-normal font-playfair text-white">
                Area <span className="italic text-[#c9b074]">Riservata</span>
              </h2>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2 text-slate-300">
                  PASSWORD AMMINISTRATORE
                </label>
                <div className="relative">
                  <input 
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none transition-colors ${
                      adminPasswordError 
                        ? "border-red-500 bg-black/50 text-white" 
                        : "bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {adminPasswordError && (
                  <p className="text-red-400 text-xs mt-1.5 font-light">
                    Password errata. Riprova.
                  </p>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-semibold text-sm py-3.5 px-4 rounded-full flex items-center justify-center gap-2 transition-all transform active:scale-95 duration-200 cursor-pointer shadow-lg mt-2"
              >
                <Lock size={15} />
                <span>Entra</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}