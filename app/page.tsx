"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Lock, LogOut, Plus, Trash2, Key, X, 
  Download, Unlock, CheckSquare, Square, Archive, Check, ZoomIn, FolderPlus,
  Eye, EyeOff, Mail, ArrowLeft, ChevronDown, HelpCircle, Loader2,
  FileSpreadsheet, FileText, Copy, Share2, ChevronLeft, ChevronRight
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { toast } from "sonner";

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
  is_minor?: boolean;
  parent_name?: string;
  parent_email?: string;
  events: EventSection[];
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossibile caricare l'immagine da: ${src}`));
    img.src = src;
  });
};

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
  const [loginLoading, setLoginLoading] = useState(false);

  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);

  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [parentNameInput, setParentNameInput] = useState("");
  const [parentEmailInput, setParentEmailInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Gestione Zoom e Playlist mobile
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [activePhotosList, setActivePhotosList] = useState<string[]>([]);
  const [zoomCurrentIndex, setZoomCurrentIndex] = useState<number>(0);

  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  const [minimizedEvents, setMinimizedEvents] = useState<{ [key: number]: boolean }>({});
  const [minimizedStudents, setMinimizedStudents] = useState<{ [key: string]: boolean }>({});
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newNome, setNewNome] = useState("");
  const [newCognome, setNewCognome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newIsMinor, setNewIsMinor] = useState(false);
  const [newEventoInput, setNewEventoInput] = useState("");
  const [newEventoDescInput, setNewEventoDescInput] = useState("");
  const [newCorsiInput, setNewCorsiInput] = useState("");

  const [newEventNames, setNewEventNames] = useState<{ [studentId: string]: string }>({});
  const [newEventDescriptions, setNewEventDescriptions] = useState<{ [studentId: string]: string }>({});
  const [newCourseNames, setNewCourseNames] = useState<{ [key: string]: string }>({});
  const [eventDescInputs, setEventDescInputs] = useState<{ [key: string]: string }>({});

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  const openZoomWithList = (photoUrl: string, list: string[]) => {
    setActivePhotosList(list);
    const index = list.indexOf(photoUrl);
    setZoomCurrentIndex(index !== -1 ? index : 0);
    setZoomPhotoUrl(photoUrl);
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const handleNextPhoto = () => {
    if (activePhotosList.length === 0) return;
    const nextIndex = (zoomCurrentIndex + 1) % activePhotosList.length;
    setZoomCurrentIndex(nextIndex);
    setZoomPhotoUrl(activePhotosList[nextIndex]);
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const handlePrevPhoto = () => {
    if (activePhotosList.length === 0) return;
    const prevIndex = (zoomCurrentIndex - 1 + activePhotosList.length) % activePhotosList.length;
    setZoomCurrentIndex(prevIndex);
    setZoomPhotoUrl(activePhotosList[prevIndex]);
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const toggleMinimizeEvent = (eIdx: number) => {
    setMinimizedEvents(prev => ({ ...prev, [eIdx]: !prev[eIdx] }));
  };

  const toggleMinimizeStudent = (studentId: string) => {
    setMinimizedStudents(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const configuredAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "nat-admin";
    if (adminPasswordInput === configuredAdminPassword) {
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
    setLoginLoading(true);

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
      setSelectedCourseFilter(null);
      
      if (formattedStudent.email) {
        setStudentEmailInput(formattedStudent.email);
      }

      if (formattedStudent.has_changed_password === true) {
        setAuthStep('dashboard');
        toast.success(`Benvenuto, ${formattedStudent.name}!`);
      } else {
        setAuthStep('change-password');
        setParentNameInput(formattedStudent.parent_name || "");
        setParentEmailInput(formattedStudent.parent_email || "");
        toast.info("Primo accesso: configura la tua password");
      }

      setLoginPassword("");
      setShowLoginPassword(false);
    } catch {
      setLoginError("Si è verificato un errore durante l'accesso.");
      toast.error("Errore di connessione");
    } finally {
      setLoginLoading(false);
    }
  };

  const handlePasswordRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setIsRecovering(true);

    const email = recoveryEmail.trim();
    if (!email) {
      toast.error("Inserisci un indirizzo email valido.");
      setIsRecovering(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .ilike("email", email)
        .single();

      if (error || !data) {
        toast.error("Indirizzo email non trovato.");
        return;
      }

      const student = data as Student;
      const randomNums = Math.floor(Math.random() * 900 + 100);
      const letters = "abcdefghjkmnpqrstuvwxyz"; 
      const randomLets = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
      const newTempPassword = `${student.name.toLowerCase().trim()}.${student.surname.toLowerCase().trim()}.${randomNums}${randomLets}`;

      const { error: updateError } = await supabase
        .from("students")
        .update({ password: newTempPassword, has_changed_password: false })
        .eq("id", student.id);

      if (updateError) {
        toast.error("Errore durante il reset della password.");
        return;
      }

      try {
        await fetch("/api/send-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: student.email?.trim() || email,
            name: student.name,
            surname: student.surname,
            password: newTempPassword,
          }),
        });
      } catch (mailErr) {
        console.error("Errore invio email:", mailErr);
      }

      toast.success("Ti è stata inviata un'email con la nuova password temporanea.");
      setRecoveryEmail("");
      setAuthStep('login');
    } catch {
      toast.error("Si è verificato un errore durante il recupero.");
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
    if (currentStudent?.is_minor && (!parentNameInput.trim() || !parentEmailInput.trim())) {
      setPasswordError("Trattandosi di un allievo minorenne, è obbligatorio inserire i dati del genitore o tutore legale.");
      toast.error("Dati genitore obbligatori");
      return;
    }
    if (!currentStudent) return;

    try {
      const { error } = await supabase
        .from("students")
        .update({ 
          password: newPasswordInput, 
          email: studentEmailInput.trim(),
          parent_name: currentStudent.is_minor ? parentNameInput.trim() : null,
          parent_email: currentStudent.is_minor ? parentEmailInput.trim() : null,
          has_changed_password: true 
        })
        .eq("id", currentStudent.id);

      if (error) throw error;

      try {
        await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: studentEmailInput.trim(),
            name: currentStudent.name,
            surname: currentStudent.surname,
          }),
        });
      } catch (mailErr) {
        console.error("Errore invio email:", mailErr);
      }

      setCurrentStudent({ 
        ...currentStudent, 
        password: newPasswordInput,
        email: studentEmailInput.trim(),
        parent_name: currentStudent.is_minor ? parentNameInput.trim() : undefined,
        parent_email: currentStudent.is_minor ? parentEmailInput.trim() : undefined,
        has_changed_password: true 
      });
      setAuthStep('dashboard');
      setSelectedPhotos([]);
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setStudentEmailInput("");
      setParentNameInput("");
      setParentEmailInput("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast.success("Password aggiornata e email di conferma inviata!");
    } catch {
      setPasswordError("Errore durante il salvataggio dei dati.");
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleResetStudentPassword = async (studentId: string, studentName: string, studentSurname: string, studentEmail?: string) => {
    const randomNums = Math.floor(Math.random() * 900 + 100);
    const letters = "abcdefghjkmnpqrstuvwxyz"; 
    const randomLets = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    const newTempPassword = `${studentName.toLowerCase().trim()}.${studentSurname.toLowerCase().trim()}.${randomNums}${randomLets}`;

    const { error } = await supabase
      .from("students")
      .update({ password: newTempPassword, has_changed_password: false })
      .eq("id", studentId);

    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }

    if (studentEmail && studentEmail.trim() !== "") {
      try {
        await fetch("/api/send-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: studentEmail.trim(),
            name: studentName,
            surname: studentSurname,
            password: newTempPassword,
          }),
        });
        toast.success(`Password rigenerata e inviata a ${studentEmail}`);
      } catch (mailErr) {
        console.error("Errore invio email:", mailErr);
        toast.warning("Password rigenerata, ma c'è stato un problema nell'invio dell'email.");
      }
    } else {
      toast.warning("Password rigenerata, ma l'allievo non ha un'email configurata.");
    }
    
    fetchStudents();
  };

  const exportStudentsCSV = () => {
    const headers = ["Nome", "Cognome", "Minorenne", "Genitore", "Email Genitore", "Password"];
    const rows = students.map(s => [
      s.name, 
      s.surname, 
      s.is_minor ? "Sì" : "No", 
      s.parent_name || "", 
      s.parent_email || "", 
      s.has_changed_password ? "[Password Definitiva Personalizzata]" : s.password
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "elenco_allievi_password.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Esportazione CSV completata!");
  };

  const exportStudentsTXT = () => {
    const textContent = students.map(s => `Nome: ${s.name} | Cognome: ${s.surname} | Minorenne: ${s.is_minor ? 'Sì (Genitore: ' + (s.parent_name || 'N/D') + ')' : 'No'} | Password: ${s.has_changed_password ? "[Password Definitiva Personalizzata]" : s.password}`).join("\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "elenco_allievi_password.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Esportazione TXT completata!");
  };

  const copyStudentsToClipboard = () => {
    const textContent = students.map(s => `${s.name} ${s.surname} ${s.is_minor ? '(Minorenne - Genitore: ' + (s.parent_name || 'N/D') + ')' : ''} - Password: ${s.has_changed_password ? "[Password Definitiva Personalizzata]" : s.password}`).join("\n");
    navigator.clipboard.writeText(textContent);
    toast.success("Elenco copiato negli appunti!");
  };

  const togglePhotoSelection = (photoUrl: string) => {
    if (navigator.vibrate) navigator.vibrate(25);
    setSelectedPhotos((prev) =>
      prev.includes(photoUrl) ? prev.filter((url) => url !== photoUrl) : [...prev, photoUrl]
    );
  };

  const toggleSelectAllPhotos = (photosList: string[]) => {
    if (navigator.vibrate) navigator.vibrate(30);
    const allSelected = photosList.every((url) => selectedPhotos.includes(url));
    if (allSelected) {
      setSelectedPhotos((prev) => prev.filter((url) => !photosList.includes(url)));
    } else {
      const newSelections = Array.from(new Set([...selectedPhotos, ...photosList]));
      setSelectedPhotos(newSelections);
    }
  };

  const handleDownloadSinglePhoto = async (photoUrl: string, fileName: string) => {
    if (navigator.vibrate) navigator.vibrate(40);
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
    if (navigator.vibrate) navigator.vibrate(50);
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

      const zipContent = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
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
      is_minor: newIsMinor,
      parent_name: null,
      parent_email: null,
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
    setNewIsMinor(false);
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

    const newDesc = eventDescInputs[key] !== undefined ? eventDescInputs[key] : (targetStudent.events[eventIndex]?.description || "");
    const updatedEvents = targetStudent.events.map((ev, eIdx) => {
      if (eIdx === eventIndex) return { ...ev, description: newDesc };
      return ev;
    });

    const { error } = await supabase.from("students").update({ events: updatedEvents }).eq("id", studentId);
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

    const { error } = await supabase.from("students").update(updatePayload).eq("id", studentId);
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

    const { error } = await supabase.from("students").update({ events: updatedEvents }).eq("id", studentId);
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

    const studentFolder = `${targetStudent.name}_${targetStudent.surname}`.toLowerCase().trim().replace(/\s+/g, "_");
    const fileArray = Array.from(files);
    const uploadedUrls: string[] = [];
    toast.info("Elaborazione e watermark foto in corso...");

    for (const file of fileArray) {
      try {
        const watermarkedBlob = await applyWatermark(file, "/logo.png");
        const fileName = `${studentFolder}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

        const { error: uploadError } = await supabase.storage
          .from("foto-allievi")
          .upload(fileName, watermarkedBlob, { contentType: "image/jpeg", upsert: true });

        if (uploadError) continue;

        const { data: urlData } = supabase.storage.from("foto-allievi").getPublicUrl(fileName);
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

    const { error } = await supabase.from("students").update(updatePayload).eq("id", studentId);
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

    const { error } = await supabase.from("students").update(updatePayload).eq("id", studentId);
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
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="w-56 h-14 bg-white/10 rounded-xl animate-pulse mb-8" />
        <div className="w-full max-w-md space-y-4">
          <div className="h-14 bg-white/10 rounded-xl animate-pulse" />
          <div className="h-14 bg-white/10 rounded-xl animate-pulse" />
          <div className="h-14 bg-[#c9b074]/20 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased bg-slate-950 text-slate-100 selection:bg-[#c9b074] selection:text-black relative overflow-hidden transition-colors duration-300 flex flex-col">

      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
        .font-playfair {
          font-family: 'Playfair Display', Georgia, serif;
        }
      `}</style>

      <header className="relative z-20 w-full px-4 sm:px-10 py-4 border-b border-[#c9b074]/20 bg-slate-950/90 backdrop-blur-xl flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center justify-start flex-1">
          {!isAdmin && authStep === 'login' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-slate-300 hover:text-white transition-all p-2 rounded-xl active:scale-95 cursor-pointer"
            >
              <Lock size={15} className="text-[#c9b074]" />
              <span className="hidden sm:inline">Staff</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-center shrink-0">
          <div className="relative h-12 sm:h-20 w-auto flex items-center justify-center">
            <Image 
              src="/logo.png" 
              alt="N.A.T. Nuova Accademia Toscanini" 
              width={500} 
              height={85} 
              className="h-full w-auto object-contain drop-shadow-[0_4px_13px_rgba(201,176,116,0.15)] brightness-110"
              priority
            />
          </div>
        </div>

        <div className="flex items-center justify-end flex-1 gap-2">
          {isAdmin ? (
            <button 
              onClick={() => { setIsAdmin(false); toast.info("Uscito dall'area staff"); }}
              className="flex items-center gap-2 px-4 py-2 border rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform active:scale-95 cursor-pointer bg-white/5 hover:bg-white/10 border-white/15 text-white"
            >
              <LogOut size={15} className="text-red-400" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          ) : authStep === 'dashboard' && currentStudent ? (
            <button 
              onClick={() => { setCurrentStudent(null); setAuthStep('login'); setSelectedPhotos([]); toast.info("Sessione chiusa"); }}
              className="flex items-center gap-2 px-3.5 py-2 border rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform active:scale-95 cursor-pointer bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-white"
            >
              <LogOut size={15} className="text-red-400" />
              <span className="truncate max-w-[100px] sm:max-w-none">Esci ({currentStudent.name})</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsFaqModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 border rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform active:scale-95 shadow-sm bg-white/5 hover:bg-white/10 border-white/15 text-white cursor-pointer"
            >
              <HelpCircle size={15} className="text-[#c9b074]" />
              <span className="hidden sm:inline">FAQ / Aiuto</span>
            </button>
          )}
        </div>
      </header>

      {isAdmin ? (
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-28 flex-1 w-full">
          <div className="mb-10">
            <h1 className="text-3xl sm:text-6xl font-normal font-playfair text-white mb-3 leading-tight">
              Gestione Allievi
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 italic">
              (Pannello Staff) - Gli allievi sono ordinati automaticamente in ordine alfabetico per cognome.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
            <div className="border border-[#c9b074]/20 rounded-3xl p-6 bg-slate-900/60 backdrop-blur-md shadow-lg">
              <span className="text-xs uppercase tracking-widest text-slate-400">Allievi Totali</span>
              <p className="text-3xl font-playfair font-normal text-white mt-2">{students.length}</p>
            </div>
            <div className="border border-[#c9b074]/20 rounded-3xl p-6 bg-slate-900/60 backdrop-blur-md shadow-lg">
              <span className="text-xs uppercase tracking-widest text-slate-400">Account Attivati</span>
              <p className="text-3xl font-playfair font-normal text-[#c9b074] mt-2">
                {students.filter(s => s.has_changed_password).length} / {students.length}
              </p>
            </div>
            <div className="border border-[#c9b074]/20 rounded-3xl p-6 bg-slate-900/60 backdrop-blur-md shadow-lg">
              <span className="text-xs uppercase tracking-widest text-slate-400">Foto Totali Caricate</span>
              <p className="text-3xl font-playfair font-normal text-white mt-2">
                {students.reduce((acc, st) => acc + getTotalPhotosCount(st), 0)}
              </p>
            </div>
          </div>

          <div className="border border-[#c9b074]/20 rounded-4xl p-6 sm:p-8 mb-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/85 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-playfair font-normal text-white mb-1">Esportazione Elenco Segreteria</h3>
              <p className="text-xs sm:text-sm text-slate-300">Scarica o copia la lista completa.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <button 
                onClick={exportStudentsCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm px-4 py-3 rounded-full transition-all cursor-pointer font-medium"
              >
                <FileSpreadsheet size={16} />
                <span>CSV</span>
              </button>
              <button 
                onClick={exportStudentsTXT}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#c9b074]/20 hover:bg-[#c9b074]/30 border border-[#c9b074]/40 text-[#c9b074] text-xs sm:text-sm px-4 py-3 rounded-full transition-all cursor-pointer font-medium"
              >
                <FileText size={16} />
                <span>TXT</span>
              </button>
              <button 
                onClick={copyStudentsToClipboard}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs sm:text-sm px-4 py-3 rounded-full transition-all cursor-pointer font-medium"
              >
                <Copy size={16} />
                <span>Copia</span>
              </button>
            </div>
          </div>

          <div className="border border-[#c9b074]/20 rounded-4xl p-6 sm:p-10 mb-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/85 shadow-xl">
            <h2 className="text-2xl sm:text-4xl font-normal mb-2 font-playfair text-white">
              Aggiungi un allievo
            </h2>
            <p className="text-xs sm:text-sm mb-6 font-light text-slate-300">
              Inserisci i dati per registrare un nuovo allievo nel sistema.
            </p>

            <form onSubmit={handleCreateStudent} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">NOME</label>
                  <input 
                    type="text" 
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Mario"
                    required
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">COGNOME</label>
                  <input 
                    type="text" 
                    value={newCognome}
                    onChange={(e) => setNewCognome(e.target.value)}
                    placeholder="Rossi"
                    required
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">EMAIL (FACOLTATIVA)</label>
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@libero.it"
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">EVENTO / SAGGIO</label>
                  <input 
                    type="text" 
                    value={newEventoInput}
                    onChange={(e) => setNewEventoInput(e.target.value)}
                    placeholder="Saggio 2026"
                    required
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">DESCRIZIONE EVENTO</label>
                  <input 
                    type="text" 
                    value={newEventoDescInput}
                    onChange={(e) => setNewEventoDescInput(e.target.value)}
                    placeholder="Concerto accademico..."
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">CORSI (SEPARATI DA VIRGOLA)</label>
                  <input 
                    type="text" 
                    value={newCorsiInput}
                    onChange={(e) => setNewCorsiInput(e.target.value)}
                    placeholder="Pianoforte, Canto"
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div className="sm:col-span-4 flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox"
                    id="newIsMinor"
                    checked={newIsMinor}
                    onChange={(e) => setNewIsMinor(e.target.checked)}
                    className="w-5 h-5 accent-[#c9b074] rounded cursor-pointer"
                  />
                  <label htmlFor="newIsMinor" className="text-xs font-semibold uppercase tracking-widest text-slate-200 cursor-pointer">
                    Allievo Minorenne (Richiede autorizzazione genitore al primo accesso)
                  </label>
                </div>
              </div>
              <button 
                type="submit"
                className="w-full sm:w-auto bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-3.5 px-8 rounded-full flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer shadow-lg mt-4"
              >
                <Plus size={18} />
                <span>Crea allievo</span>
              </button>
            </form>
          </div>

          <div className="mb-8">
            <input
              type="text"
              placeholder="Cerca allievo..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full px-5 py-3.5 rounded-3xl backdrop-blur-xl bg-slate-900/60 border border-[#c9b074]/20 text-white placeholder-slate-400 focus:outline-none focus:border-[#c9b074] transition-colors text-sm shadow-xl"
            />
          </div>

          <div className="space-y-6">
            {filteredStaffStudents.map((student) => {
              const isStudentMinimized = minimizedStudents[student.id];
              return (
                <div key={student.id} className="border border-[#c9b074]/20 rounded-4xl p-6 sm:p-8 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/85 shadow-xl transition-all">
                  <div 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none"
                    onClick={() => toggleMinimizeStudent(student.id)}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl sm:text-3xl font-normal font-playfair text-white">
                          {student.surname} {student.name}
                        </h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${student.is_minor ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'}`}>
                          {student.is_minor ? 'Minorenne' : 'Maggiorenne'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-xs sm:text-sm font-mono mt-2 text-slate-300">
                        {student.is_minor && (
                          <div className="flex items-center gap-2 text-amber-200/90 font-sans text-xs">
                            <span>Genitore/Tutore: <strong>{student.parent_name || 'Non specificato'}</strong> ({student.parent_email || 'Nessuna email'})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Key size={14} />
                          <span>
                            Password: {student.has_changed_password ? (
                              <span className="text-[#c9b074] italic font-sans font-medium">[Password Definitiva Personalizzata dall'Allievo]</span>
                            ) : (
                              <span>{student.password}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          <Mail size={14} />
                          <span>Email: {student.email || "Non registrata"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleResetStudentPassword(student.id, student.name, student.surname, student.email)}
                          className="flex items-center gap-1.5 border border-[#c9b074]/40 text-[#c9b074] hover:bg-[#c9b074]/10 text-xs px-3.5 py-2 rounded-full transition-all active:scale-95 cursor-pointer font-medium"
                        >
                          <Key size={14} />
                          <span>Rigenera e Invia Email</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs px-3.5 py-2 rounded-full transition-all active:scale-95 cursor-pointer font-medium"
                        >
                          <Trash2 size={14} />
                          <span>Elimina</span>
                        </button>
                      </div>
                      <div className="p-2 rounded-full bg-white/5 text-[#c9b074]">
                        <ChevronDown size={20} className={`transform transition-transform duration-300 ${isStudentMinimized ? "rotate-0" : "rotate-180"}`} />
                      </div>
                    </div>
                  </div>

                  {!isStudentMinimized && (
                    <div className="mt-6 pt-6 border-t border-white/15 space-y-6 animate-fadeIn">
                      <div className="p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3">
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <input 
                            type="text"
                            placeholder="Nome nuovo evento..."
                            value={newEventNames[student.id] || ""}
                            onChange={(e) => setNewEventNames({ ...newEventNames, [student.id]: e.target.value })}
                            className="w-full sm:flex-1 border rounded-2xl px-4 py-2.5 text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                          />
                          <button 
                            onClick={() => handleAddEvent(student.id)}
                            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                          >
                            <FolderPlus size={16} className="text-[#c9b074]" />
                            <span>Aggiungi Evento</span>
                          </button>
                        </div>
                        <input 
                          type="text"
                          placeholder="Descrizione evento (facoltativa)..."
                          value={newEventDescriptions[student.id] || ""}
                          onChange={(e) => setNewEventDescriptions({ ...newEventDescriptions, [student.id]: e.target.value })}
                          className="w-full border rounded-2xl px-4 py-2.5 text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                        />
                      </div>

                      <div className="space-y-6">
                        {student.events.map((event, eIdx) => (
                          <div key={eIdx} className="border rounded-3xl p-4 sm:p-6 bg-black/30 border-white/15">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                              <h4 className="text-xl sm:text-2xl font-normal font-playfair text-[#c9b074]">
                                {event.eventName}
                              </h4>
                              <button 
                                onClick={() => handleDeleteEvent(student.id, eIdx)}
                                className="flex items-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs px-3 py-1.5 rounded-full transition-all active:scale-95 cursor-pointer"
                              >
                                <Trash2 size={13} />
                                <span>Elimina</span>
                              </button>
                            </div>

                            <div className="mb-4">
                              <div className="flex flex-col sm:flex-row items-center gap-2">
                                <input 
                                  type="text"
                                  placeholder="Descrizione..."
                                  defaultValue={event.description || ""}
                                  onChange={(e) => setEventDescInputs({ ...eventDescInputs, [`${student.id}-${eIdx}`]: e.target.value })}
                                  className="w-full sm:flex-1 border rounded-xl px-3.5 py-2 text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                                />
                                <button 
                                  onClick={() => handleSaveEventDescription(student.id, eIdx)}
                                  className="w-full sm:w-auto bg-[#c9b074]/20 hover:bg-[#c9b074]/30 border border-[#c9b074]/40 text-[#c9b074] text-xs px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer font-bold"
                                >
                                  Salva
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
                              <input 
                                type="text"
                                placeholder="Nuovo corso..."
                                value={newCourseNames[`${student.id}-${eIdx}`] || ""}
                                onChange={(e) => setNewCourseNames({ ...newCourseNames, [`${student.id}-${eIdx}`]: e.target.value })}
                                className="w-full sm:flex-1 border rounded-xl px-3.5 py-2 text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                              />
                              <button 
                                onClick={() => handleAddCourseToEvent(student.id, eIdx)}
                                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              >
                                <Plus size={14} /> Corso
                              </button>
                            </div>

                            <div className="space-y-4">
                              {event.courses.map((course, cIdx) => (
                                <div key={cIdx} className="border rounded-2xl p-4 bg-black/50 border-white/10">
                                  <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm sm:text-base font-bold text-slate-100 font-playfair">
                                      Corso di {course.name}
                                    </span>
                                    <span className="text-xs text-slate-300">{course.photos.length} foto</span>
                                  </div>

                                  {course.photos.length > 0 ? (
                                    <div className="flex flex-wrap gap-2.5 mb-3">
                                      {course.photos.map((photoUrl, pIdx) => (
                                        <div key={pIdx} className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/15 group bg-black cursor-pointer">
                                          <img 
                                            src={photoUrl} 
                                            alt={`Foto ${course.name}`} 
                                            onClick={() => openZoomWithList(photoUrl, course.photos)}
                                            className="w-full h-full object-cover" 
                                          />
                                          <button 
                                            onClick={() => handleDeletePhoto(student.id, eIdx, cIdx, pIdx)}
                                            className="absolute top-1 right-1 bg-black/80 text-red-400 p-1 rounded-full opacity-90 group-hover:opacity-100 shadow"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs italic mb-3 text-slate-400">Nessuna foto.</p>
                                  )}

                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*"
                                    onChange={(e) => handleFileUpload(student.id, eIdx, cIdx, e.target.files)}
                                    className="w-full text-xs text-slate-200 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/25 cursor-pointer"
                                  />
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
        <main className="relative z-10 max-w-lg mx-auto px-4 pt-16 pb-28 flex-1 w-full flex items-center justify-center">
          <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/85 shadow-xl text-white w-full">
            <div className="text-center mb-6">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-2">Primo Accesso</span>
              <h2 className="text-3xl font-normal font-playfair">
                {currentStudent.is_minor ? `Configurazione per: ${currentStudent.name} ${currentStudent.surname}` : `Benvenuto, ${currentStudent.name}!`}
              </h2>
              <p className="text-xs sm:text-sm mt-2 text-slate-300">
                {currentStudent.is_minor 
                  ? "Questo account risulta registrato come minorenne. È richiesto il consenso e l'autorizzazione di un genitore o tutore." 
                  : "Configura password definitiva ed email."}
              </p>
            </div>

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-xl text-xs font-medium">
                  {passwordError}
                </div>
              )}

              {currentStudent.is_minor && (
                <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c9b074]">
                    Informazioni Genitore / Tutore Legale (Obbligatorie)
                  </h3>
                  
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">
                      Nome e Cognome del Genitore
                    </label>
                    <input
                      type="text"
                      required={currentStudent.is_minor}
                      value={parentNameInput}
                      onChange={(e) => setParentNameInput(e.target.value)}
                      placeholder="es. Maria Rossi"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-[#c9b074]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">
                      Email di riferimento Genitore
                    </label>
                    <input
                      type="email"
                      required={currentStudent.is_minor}
                      value={parentEmailInput}
                      onChange={(e) => setParentEmailInput(e.target.value)}
                      placeholder="genitore@example.com"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-[#c9b074]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Nuova Password</label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPasswordInput} 
                    onChange={(e) => setNewPasswordInput(e.target.value)} 
                    required 
                    placeholder="Min. 6 caratteri"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 pr-11 text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Conferma Password</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPasswordInput} 
                    onChange={(e) => setConfirmPasswordInput(e.target.value)} 
                    required 
                    placeholder="Ripeti password"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 pr-11 text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-3.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg mt-2 flex items-center justify-center gap-2"
              >
                <Check size={16} />
                <span>Salva e Accedi alla Galleria</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'forgot-password' ? (
        <main className="relative z-10 max-w-lg mx-auto px-4 pt-16 pb-28 flex-1 w-full flex items-center justify-center">
          <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/85 shadow-xl text-white w-full">
            <button onClick={() => { setAuthStep('login'); setRecoveryEmail(""); }} className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white mb-4 cursor-pointer font-medium">
              <ArrowLeft size={15} /> Torna al login
            </button>
            <div className="text-center mb-6">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-1">Supporto</span>
              <h2 className="text-3xl font-normal font-playfair">Recupera Password</h2>
            </div>
            <form onSubmit={handlePasswordRecoverySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Email</label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={recoveryEmail} 
                    onChange={(e) => setRecoveryEmail(e.target.value)} 
                    required 
                    placeholder="email@libero.it"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 pl-11 text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isRecovering}
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-3.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Mail size={16} />
                <span>{isRecovering ? "Invio..." : "Invia email di recupero"}</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'dashboard' && currentStudent ? (
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-32 flex-1 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b pb-6 border-white/10">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] uppercase mb-1 text-slate-300">Area Allievo</p>
              <h1 className="text-3xl sm:text-5xl font-normal font-playfair text-white">
                Foto di <span className="italic text-[#c9b074]">{currentStudent.name} {currentStudent.surname}</span>
              </h1>
            </div>

            <button 
              onClick={() => {
                const allPhotos = currentStudent.events.flatMap((ev) => ev.courses.flatMap((c) => c.photos));
                downloadZip(allPhotos, `saggio-${currentStudent.surname}-${currentStudent.name}`);
              }}
              disabled={isZipping || getTotalPhotosCount(currentStudent) === 0}
              className="hidden sm:flex items-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm px-5 py-3 rounded-full transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg"
            >
              <Archive size={16} />
              <span>{isZipping ? "Creazione ZIP..." : "Scarica TUTTO (.zip)"}</span>
            </button>
          </div>

          {selectedPhotos.length > 0 && (
            <div className="sticky top-4 z-40 backdrop-blur-xl border rounded-2xl p-4 mb-8 flex justify-between items-center shadow-2xl bg-slate-900/90 border-[#c9b074]/40 text-white animate-fadeIn">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
                <span className="w-7 h-7 rounded-full bg-[#c9b074] text-black font-bold flex items-center justify-center text-xs">
                  {selectedPhotos.length}
                </span>
                <span>selezionate</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedPhotos([])} className="text-xs sm:text-sm text-slate-300 hover:text-white font-medium cursor-pointer">
                  Deseleziona
                </button>
                <button 
                  onClick={() => downloadZip(selectedPhotos, `foto-selezionate-${currentStudent.surname}`)}
                  disabled={isZipping}
                  className="flex items-center gap-1.5 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-xs sm:text-sm px-4 py-2 rounded-full transition-all active:scale-95 cursor-pointer shadow"
                >
                  <Download size={14} />
                  <span>Scarica ZIP</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {currentStudent.events.map((event, eIdx) => {
              const filteredCourses = event.courses.filter(c => selectedCourseFilter === null || c.name === selectedCourseFilter);
              if (filteredCourses.length === 0) return null;

              const allEventPhotos = filteredCourses.flatMap((c) => c.photos);
              const isAllEventSelected = allEventPhotos.length > 0 && allEventPhotos.every((p) => selectedPhotos.includes(p));
              const isMinimized = minimizedEvents[eIdx];

              return (
                <div key={eIdx} className="border-2 border-[#c9b074]/30 rounded-4xl p-5 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/85 shadow-xl transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/15">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleMinimizeEvent(eIdx)}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#c9b074] transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <ChevronDown size={20} className={`transition-transform duration-300 ${isMinimized ? "-rotate-90" : "rotate-0"}`} />
                      </button>
                      <div>
                        <span className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-[#c9b074] block mb-1">Evento</span>
                        <h2 className="text-2xl sm:text-4xl font-normal font-playfair text-white">{event.eventName}</h2>
                        {event.description && <p className="text-xs sm:text-sm text-slate-200 mt-1 font-light">{event.description}</p>}
                      </div>
                    </div>

                    {allEventPhotos.length > 0 && !isMinimized && (
                      <button 
                        onClick={() => toggleSelectAllPhotos(allEventPhotos)}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-full transition-all active:scale-95 cursor-pointer shadow"
                      >
                        {isAllEventSelected ? <CheckSquare size={16} className="text-[#c9b074]" /> : <Square size={16} />}
                        <span>{isAllEventSelected ? "Deseleziona tutto" : "Seleziona tutto"}</span>
                      </button>
                    )}
                  </div>

                  {!isMinimized && (
                    <div className="space-y-6">
                      {filteredCourses.map((course, cIdx) => {
                        const isAllCourseSelected = course.photos.length > 0 && course.photos.every((p) => selectedPhotos.includes(p));

                        return (
                          <div key={cIdx} className="border border-[#c9b074]/20 rounded-3xl p-4 sm:p-6 bg-black/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
                              <h3 className="text-xl sm:text-2xl font-normal font-playfair flex items-center gap-2.5 text-white">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074]"></span>
                                Corso di {course.name}
                              </h3>
                              {course.photos.length > 0 && (
                                <button 
                                  onClick={() => toggleSelectAllPhotos(course.photos)}
                                  className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white cursor-pointer font-medium"
                                >
                                  {isAllCourseSelected ? <CheckSquare size={16} className="text-[#c9b074]" /> : <Square size={16} />}
                                  <span>{isAllCourseSelected ? "Deseleziona corso" : "Seleziona corso"}</span>
                                </button>
                              )}
                            </div>

                            {course.photos.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                                {course.photos.map((photoUrl, pIdx) => {
                                  const isSelected = selectedPhotos.includes(photoUrl);
                                  return (
                                    <div 
                                      key={pIdx} 
                                      className={`relative group rounded-2xl overflow-hidden border cursor-pointer transition-all aspect-square bg-black shadow-lg ${
                                        isSelected ? "border-[#c9b074] ring-2 ring-[#c9b074]/60 scale-[1.01]" : "border-white/15"
                                      }`}
                                    >
                                      <img 
                                        src={photoUrl} 
                                        alt={`Foto ${course.name}`} 
                                        onClick={() => openZoomWithList(photoUrl, course.photos)}
                                        className="w-full h-full object-cover" 
                                      />
                                      <div 
                                        onClick={() => openZoomWithList(photoUrl, course.photos)}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center sm:flex pointer-events-none"
                                      >
                                        <span className="hidden sm:inline-block bg-black/75 text-white text-xs px-3 py-1.5 rounded-full border border-white/20 shadow">
                                          <ZoomIn size={14} className="inline mr-1 text-[#c9b074]" /> Ingrandisci
                                        </span>
                                      </div>

                                      <div 
                                        onClick={(e) => { e.stopPropagation(); togglePhotoSelection(photoUrl); }}
                                        className="absolute top-2.5 left-2.5 z-10"
                                      >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                          isSelected ? "bg-[#c9b074] text-black shadow scale-110" : "bg-black/60 border border-white/40 text-transparent"
                                        }`}>
                                          <Check size={14} className="stroke-[3]" />
                                        </div>
                                      </div>

                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadSinglePhoto(photoUrl, `foto-${currentStudent.name}-${event.eventName}-${course.name}-${pIdx + 1}.jpg`);
                                        }}
                                        className="absolute top-2.5 right-2.5 bg-black/70 text-white p-2 rounded-full shadow z-20 cursor-pointer"
                                      >
                                        <Download size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm italic text-slate-400">Nessuna foto disponibile per questo corso.</p>
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

          <div className="fixed bottom-6 right-6 z-40 sm:hidden flex items-center gap-2">
            {selectedPhotos.length > 0 ? (
              <button
                onClick={() => downloadZip(selectedPhotos, `foto-selezionate-${currentStudent.surname}`)}
                className="bg-[#c9b074] text-black font-bold px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-2 active:scale-95 transition-transform"
              >
                <Download size={18} />
                <span className="text-xs">Scarica ({selectedPhotos.length})</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const allPhotos = currentStudent.events.flatMap((ev) => ev.courses.flatMap((c) => c.photos));
                  downloadZip(allPhotos, `saggio-${currentStudent.surname}-${currentStudent.name}`);
                }}
                disabled={isZipping || getTotalPhotosCount(currentStudent) === 0}
                className="bg-[#c9b074] text-black font-bold px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
              >
                <Archive size={18} />
                <span className="text-xs">{isZipping ? "ZIP..." : "Scarica Tutto"}</span>
              </button>
            )}
          </div>
        </main>
      ) : (
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-10 lg:px-12 py-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20">
          <div className="w-full lg:w-7/12 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            <span className="text-xs font-semibold tracking-[0.4em] uppercase text-[#c9b074]">NUOVA ACCADEMIA TOSCANINI</span>
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-normal leading-[1.1] tracking-tight font-playfair text-white">
              Accedi alla tua <br />
              <span className="italic font-normal bg-gradient-to-r from-white via-[#c9b074] to-slate-300 bg-clip-text text-transparent">Galleria Privata</span>
            </h1>
            <p className="text-sm sm:text-lg max-w-2xl font-normal leading-relaxed text-slate-200">
              Inserisci le credenziali ufficiali fornite dalla segreteria dell'accademia per esplorare, selezionare e scaricare i tuoi ricordi in alta definizione.
            </p>
          </div>

          <div className="w-full lg:w-5/12 max-w-md">
            <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/75 to-slate-950/95 shadow-2xl relative overflow-hidden">
              <form onSubmit={handleStudentLoginSubmit} className="space-y-4 sm:space-y-6">
                {loginError && (
                  <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-2xl text-xs font-medium">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Nome</label>
                  <input 
                    type="text" 
                    value={loginName} 
                    onChange={(e) => setLoginName(e.target.value)} 
                    required 
                    placeholder="Mario"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Cognome</label>
                  <input 
                    type="text" 
                    value={loginSurname} 
                    onChange={(e) => setLoginSurname(e.target.value)} 
                    required 
                    placeholder="Rossi"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Password</label>
                  <div className="relative">
                    <input 
                      type={showLoginPassword ? "text" : "password"} 
                      value={loginPassword} 
                      onChange={(e) => setLoginPassword(e.target.value)} 
                      required 
                      placeholder="••••••••••••"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                    />
                    <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-4 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loginLoading ? <Loader2 size={18} className="animate-spin" /> : <Unlock size={16} />}
                  <span>{loginLoading ? "Accesso..." : "Accedi alla galleria"}</span>
                </button>
                <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-2 text-center">
                  <button type="button" onClick={() => setAuthStep('forgot-password')} className="text-xs sm:text-sm text-[#c9b074] hover:underline cursor-pointer font-semibold">
                    Hai dimenticato la password?
                  </button>
                  <p className="text-[11px] text-slate-300">Rivolgiti in segreteria per il primo accesso.</p>
                </div>
              </form>
            </div>
          </div>
        </main>
      )}

      {zoomPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 sm:p-8 animate-fadeIn"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div className="w-full max-w-6xl flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs sm:text-sm text-slate-300 font-mono">
              {zoomCurrentIndex + 1} / {activePhotosList.length}
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  const shareText = "Guarda questa foto del mio saggio all'Accademia Toscanini!";
                  if (navigator.share) {
                    navigator.share({ title: "Accademia Toscanini", text: shareText, url: zoomPhotoUrl }).catch(() => {});
                  } else {
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + zoomPhotoUrl)}`, '_blank');
                  }
                }}
                className="flex items-center gap-1.5 bg-emerald-600/20 text-emerald-300 font-bold text-xs px-3.5 py-2 rounded-full cursor-pointer"
              >
                <Share2 size={14} />
                <span className="hidden sm:inline">Condividi</span>
              </button>
              <button 
                onClick={() => handleDownloadSinglePhoto(zoomPhotoUrl, "foto-saggio-nat.jpg")}
                className="flex items-center gap-1.5 bg-[#c9b074] text-black font-bold text-xs px-4 py-2 rounded-full shadow cursor-pointer"
              >
                <Download size={14} />
                <span>Scarica</span>
              </button>
              <button onClick={() => setZoomPhotoUrl(null)} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full cursor-pointer">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="relative w-full max-w-5xl h-[70vh] my-auto flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {activePhotosList.length > 1 && (
              <>
                <button 
                  onClick={handlePrevPhoto} 
                  className="absolute left-2 sm:-left-4 z-20 bg-black/70 hover:bg-black text-white p-3 rounded-full border border-white/20 shadow-xl cursor-pointer active:scale-95"
                >
                  <ChevronLeft size={22} />
                </button>
                <button 
                  onClick={handleNextPhoto} 
                  className="absolute right-2 sm:-right-4 z-20 bg-black/70 hover:bg-black text-white p-3 rounded-full border border-white/20 shadow-xl cursor-pointer active:scale-95"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
            <img 
              src={zoomPhotoUrl} 
              alt="Anteprima foto" 
              className="max-w-full max-h-[70vh] object-contain rounded-2xl select-none shadow-2xl"
            />
          </div>

          <p className="text-slate-400 text-xs italic z-10">Tocca fuori o chiudi per tornare alla galleria</p>
        </div>
      )}

      {isFaqModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 max-w-xl w-full max-h-[90vh] overflow-y-auto relative backdrop-blur-2xl bg-slate-950/90 text-white shadow-2xl">
            <button onClick={() => setIsFaqModalOpen(false)} className="absolute top-5 right-5 p-2 rounded-full text-slate-300 hover:text-white bg-white/5 cursor-pointer">
              <X size={18} />
            </button>
            <div className="text-center mb-6">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-1 text-[#c9b074]">Assistenza</p>
              <h2 className="text-3xl font-normal font-playfair text-white">FAQ</h2>
            </div>
            <div className="space-y-4 text-xs sm:text-sm text-slate-200">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="font-bold text-white mb-1 font-playfair">1. Primo Accesso</h3>
                <p>Inserisci Nome, Cognome e password provvisoria fornita dalla segreteria.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="font-bold text-white mb-1 font-playfair">2. Configurazione Account e Minorenni</h3>
                <p>Se l'allievo è minorenne, durante il primo accesso verrà richiesto obbligatoriamente di inserire nome, cognome e email del genitore o tutore legale.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="font-bold text-white mb-1 font-playfair">3. Recupero Password</h3>
                <p>Usa il link di recupero nella schermata di login oppure contatta la segreteria.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="font-bold text-white mb-1 font-playfair">4. Problemi con l'Accesso</h3>
                <p>Se hai problemi con l'accesso, contatta la segreteria per assistenza.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="font-bold text-white mb-1 font-playfair">5. Scaricamento Foto</h3>
                <p>Per il download delle foto, seleziona l'opzione "Scarica" nell'anteprima della foto.</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <button onClick={() => setIsFaqModalOpen(false)} className="bg-[#c9b074] text-black font-bold text-xs sm:text-sm py-3 px-6 rounded-full cursor-pointer shadow">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 max-w-md w-full relative backdrop-blur-2xl bg-slate-950/90 text-white shadow-2xl">
            <button onClick={() => { setIsModalOpen(false); setAdminPasswordError(false); setAdminPasswordInput(""); }} className="absolute top-5 right-5 p-2 rounded-full text-slate-300 hover:text-white bg-white/5 cursor-pointer">
              <X size={18} />
            </button>
            <div className="text-center mb-6">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-1 text-slate-300">RISERVATO ALLO STAFF</p>
              <h2 className="text-3xl font-normal font-playfair text-white">Area Riservata</h2>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">PASSWORD</label>
                <div className="relative">
                  <input 
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 pr-11 text-sm text-white focus:outline-none focus:border-[#c9b074]"
                  />
                  <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer">
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {adminPasswordError && <p className="text-red-400 text-xs mt-2 font-medium">Password errata.</p>}
              </div>
              <button type="submit" className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-3.5 rounded-full flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2">
                <Lock size={16} /> Entra
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}