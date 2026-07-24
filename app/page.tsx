"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Lock, LogOut, Plus, Trash2, Key, X, 
  Download, Unlock, CheckSquare, Square, Archive, Check, ZoomIn, FolderPlus,
  Eye, EyeOff, Mail, ArrowLeft, ChevronDown, HelpCircle, Loader2,
  FileSpreadsheet, FileText, Copy, Share2
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
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [newNome, setNewNome] = useState("");
  const [newCognome, setNewCognome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNumber, setNewNumber] = useState("");
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

      try {
        await fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: student.email?.trim() || email,
            name: student.name,
            surname: student.surname,
            password: newPasswordInput,
          }),
        });
      } catch (mailErr) {
        console.error("Errore invio email:", mailErr);
      }

      toast.success("Se l'email è registrata, riceverai le istruzioni per il recupero.");
      setRecoveryEmail("");
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
        has_changed_password: true 
      });
      setAuthStep('dashboard');
      setSelectedPhotos([]);
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setStudentEmailInput("");
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      toast.success("Password aggiornata e email di conferma inviata!");
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

  const exportStudentsCSV = () => {
    const headers = ["Nome", "Cognome", "Password"];
    const rows = students.map(s => [s.name, s.surname, s.password]);
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
    const textContent = students.map(s => `Nome: ${s.name} | Cognome: ${s.surname} | Password: ${s.password}`).join("\n");
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
    const textContent = students.map(s => `${s.name} ${s.surname} - Password: ${s.password}`).join("\n");
    navigator.clipboard.writeText(textContent);
    toast.success("Elenco copiato negli appunti!");
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

      <header className="relative z-20 w-full px-6 sm:px-10 py-5 border-b border-[#c9b074]/20 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center justify-start flex-1">
          {!isAdmin && authStep === 'login' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-slate-300 hover:text-white transition-all transform active:scale-95 cursor-pointer"
            >
              <Lock size={15} className="text-[#c9b074]" />
              <span className="hidden sm:inline">Area Riservata</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-center shrink-0">
          <div className="relative h-14 sm:h-20 w-auto flex items-center justify-center">
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

        <div className="flex items-center justify-end flex-1 gap-3">
          {isAdmin ? (
            <button 
              onClick={() => { setIsAdmin(false); toast.info("Uscito dall'area staff"); }}
              className="flex items-center gap-2 px-5 py-2.5 border rounded-full text-sm font-medium transition-all duration-200 transform active:scale-95 cursor-pointer shadow-sm bg-white/5 hover:bg-white/10 border-white/15 text-white"
            >
              <LogOut size={16} className="text-red-400" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          ) : authStep === 'dashboard' && currentStudent ? (
            <button 
              onClick={() => { setCurrentStudent(null); setAuthStep('login'); setSelectedPhotos([]); toast.info("Sessione chiusa"); }}
              className="flex items-center gap-2 px-5 py-2.5 border rounded-full text-sm font-medium transition-all duration-200 transform active:scale-95 cursor-pointer shadow-sm bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-white"
            >
              <LogOut size={16} className="text-red-400" />
              <span>Esci ({currentStudent.name})</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsFaqModalOpen(true)}
              className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 border rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform active:scale-95 shadow-sm bg-white/5 hover:bg-white/10 border-white/15 text-white cursor-pointer"
            >
              <HelpCircle size={15} className="text-[#c9b074]" />
              <span>FAQ / Aiuto</span>
            </button>
          )}
        </div>
      </header>

      {isAdmin ? (
        <main className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 pt-12 pb-28 flex-1 w-full">
          <div className="mb-10">
            <h1 className="text-4xl sm:text-6xl font-normal font-playfair text-white mb-3 leading-tight">
              Gestione Allievi
            </h1>
            <p className="text-base sm:text-lg text-slate-300 italic">
              (Pannello Staff) - Gli allievi sono ordinati automaticamente in ordine alfabetico per cognome.
            </p>
          </div>

          {/* PANNELLO STATISTICHE STAFF */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
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

          {/* BOX ESPORTAZIONE ELENCO */}
          <div className="border border-[#c9b074]/20 rounded-4xl p-6 sm:p-8 mb-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-playfair font-normal text-white mb-1">Esportazione Elenco Segreteria</h3>
              <p className="text-xs sm:text-sm text-slate-300">Scarica o copia la lista completa con nome, cognome e password provvisorie.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={exportStudentsCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm px-4.5 py-3 rounded-full transition-all cursor-pointer font-medium"
              >
                <FileSpreadsheet size={16} />
                <span>Esporta CSV</span>
              </button>
              <button 
                onClick={exportStudentsTXT}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#c9b074]/20 hover:bg-[#c9b074]/30 border border-[#c9b074]/40 text-[#c9b074] text-xs sm:text-sm px-4.5 py-3 rounded-full transition-all cursor-pointer font-medium"
              >
                <FileText size={16} />
                <span>Esporta TXT</span>
              </button>
              <button 
                onClick={copyStudentsToClipboard}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs sm:text-sm px-4.5 py-3 rounded-full transition-all cursor-pointer font-medium"
              >
                <Copy size={16} />
                <span>Copia Elenco</span>
              </button>
            </div>
          </div>

          <div className="border border-[#c9b074]/20 rounded-4xl p-8 sm:p-10 mb-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300">
            <h2 className="text-3xl sm:text-4xl font-normal mb-2 font-playfair text-white">
              Aggiungi un allievo
            </h2>
            <p className="text-sm mb-8 font-light text-slate-300">
              Inserisci i dati per registrare un nuovo allievo nel sistema.
            </p>

            <form onSubmit={handleCreateStudent} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    NOME
                  </label>
                  <input 
                    type="text" 
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Mario"
                    required
                    className="w-full border rounded-2xl px-5 py-3.5 text-lg sm:text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    COGNOME
                  </label>
                  <input 
                    type="text" 
                    value={newCognome}
                    onChange={(e) => setNewCognome(e.target.value)}
                    placeholder="Rossi"
                    required
                    className="w-full border rounded-2xl px-5 py-3.5 text-lg sm:text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    EMAIL (FACOLTATIVA)
                  </label>
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="mario.rossi@email.com"
                    className="w-full border rounded-2xl px-5 py-3.5 text-lg sm:text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    EVENTO / SAGGIO
                  </label>
                  <input 
                    type="text" 
                    value={newEventoInput}
                    onChange={(e) => setNewEventoInput(e.target.value)}
                    placeholder="Saggio Fine Anno 2026"
                    required
                    className="w-full border rounded-2xl px-5 py-3.5 text-lg sm:text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    DESCRIZIONE EVENTO (FACOLTATIVA)
                  </label>
                  <input 
                    type="text" 
                    value={newEventoDescInput}
                    onChange={(e) => setNewEventoDescInput(e.target.value)}
                    placeholder="Es. Concerto di fine anno accademico..."
                    className="w-full border rounded-2xl px-5 py-3.5 text-lg sm:text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    CORSI (SEPARATI DA VIRGOLA)
                  </label>
                  <input 
                    type="text" 
                    value={newCorsiInput}
                    onChange={(e) => setNewCorsiInput(e.target.value)}
                    placeholder="es. Pianoforte, Canto"
                    className="w-full border rounded-2xl px-5 py-3.5 text-lg sm:text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm sm:text-base py-3.5 px-8 rounded-full flex items-center gap-2.5 transition-all transform active:scale-95 cursor-pointer mt-4 shadow-lg"
              >
                <Plus size={18} />
                <span>Crea allievo</span>
              </button>
            </form>
          </div>

          <div className="mb-8">
            <input
              type="text"
              placeholder="Cerca allievo per nome, cognome o email..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full px-6 py-4 rounded-3xl backdrop-blur-xl bg-slate-900/60 border border-[#c9b074]/20 text-white placeholder-slate-400 focus:outline-none focus:border-[#c9b074] transition-colors text-lg sm:text-base shadow-xl"
            />
          </div>

          <div className="space-y-8">
            {filteredStaffStudents.map((student) => {
              const isStudentMinimized = minimizedStudents[student.id];

              return (
                <div key={student.id} className="border border-[#c9b074]/20 rounded-4xl p-8 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
                  <div 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 cursor-pointer select-none"
                    onClick={() => toggleMinimizeStudent(student.id)}
                  >
                    <div>
                      <h3 className="text-3xl sm:text-4xl font-normal font-playfair text-white">
                        {student.surname} {student.name}
                      </h3>
                      <div className="flex flex-col gap-1.5 text-sm font-mono mt-2 text-slate-300">
                        <div className="flex items-center gap-2">
                          <Key size={15} />
                          <span>Password provvisoria: {student.password}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-200">
                          <Mail size={15} />
                          <span>Email: {student.email || "Non ancora registrata"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex flex-wrap items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleResetStudentPassword(student.id, student.name, student.surname)}
                          className="flex items-center gap-2 border border-[#c9b074]/40 text-[#c9b074] hover:bg-[#c9b074]/10 text-xs sm:text-sm px-4.5 py-2.5 rounded-full transition-all transform active:scale-95 cursor-pointer font-medium"
                        >
                          <Key size={15} />
                          <span className="hidden md:inline">Rigenera Password</span>
                        </button>

                        <button 
                          onClick={() => handleDeleteStudent(student.id)}
                          className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs sm:text-sm px-4.5 py-2.5 rounded-full transition-all transform active:scale-95 cursor-pointer font-medium"
                        >
                          <Trash2 size={15} />
                          <span className="hidden md:inline">Elimina</span>
                        </button>
                      </div>

                      <button 
                        type="button"
                        aria-label={isStudentMinimized ? "Espandi" : "Minimizza"}
                        className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 transition-colors shrink-0"
                      >
                        <ChevronDown 
                          size={24} 
                          className={`transform transition-transform duration-300 text-[#c9b074] ${isStudentMinimized ? "rotate-0" : "rotate-180"}`} 
                        />
                      </button>
                    </div>
                  </div>

                  {!isStudentMinimized && (
                    <div className="mt-8 pt-8 border-t border-white/15 space-y-8 animate-fadeIn">
                      <div className="mb-8 p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4 backdrop-blur-md">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <input 
                            type="text"
                            placeholder="Nome nuovo evento..."
                            value={newEventNames[student.id] || ""}
                            onChange={(e) => setNewEventNames({ ...newEventNames, [student.id]: e.target.value })}
                            className="w-full sm:flex-1 border rounded-2xl px-5 py-3 text-lg sm:text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                          />
                          <button 
                            onClick={() => handleAddEvent(student.id)}
                            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white font-bold text-sm px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-md"
                          >
                            <FolderPlus size={16} className="text-[#c9b074]" />
                            <span>Aggiungi Evento</span>
                          </button>
                        </div>
                        <div>
                          <input 
                            type="text"
                            placeholder="Descrizione evento (facoltativa)..."
                            value={newEventDescriptions[student.id] || ""}
                            onChange={(e) => setNewEventDescriptions({ ...newEventDescriptions, [student.id]: e.target.value })}
                            className="w-full border rounded-2xl px-5 py-3 text-lg sm:text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                          />
                        </div>
                      </div>

                      <div className="space-y-8">
                        {student.events.map((event, eIdx) => (
                          <div key={eIdx} className="border rounded-3xl p-6 sm:p-8 bg-black/30 border-white/15 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                              <h4 className="text-2xl sm:text-3xl font-normal font-playfair text-[#c9b074]">
                                {event.eventName}
                              </h4>

                              <button 
                                onClick={() => handleDeleteEvent(student.id, eIdx)}
                                className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs sm:text-sm px-4 py-2 rounded-full transition-all transform active:scale-95 cursor-pointer font-medium"
                              >
                                <Trash2 size={14} />
                                <span>Elimina evento</span>
                              </button>
                            </div>

                            <div className="mb-6">
                              <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-300">
                                DESCRIZIONE EVENTO
                              </label>
                              <div className="flex flex-col sm:flex-row items-center gap-3">
                                <input 
                                  type="text"
                                  placeholder="Aggiungi una descrizione per questo evento..."
                                  defaultValue={event.description || ""}
                                  onChange={(e) => setEventDescInputs({ ...eventDescInputs, [`${student.id}-${eIdx}`]: e.target.value })}
                                  className="w-full sm:flex-1 border rounded-2xl px-4.5 py-3 text-lg sm:text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                                />
                                <button 
                                  onClick={() => handleSaveEventDescription(student.id, eIdx)}
                                  className="w-full sm:w-auto bg-[#c9b074]/20 hover:bg-[#c9b074]/30 border border-[#c9b074]/40 text-[#c9b074] text-sm px-5 py-3 rounded-2xl transition-all transform active:scale-95 cursor-pointer font-bold shadow-md"
                                >
                                  Salva Descrizione
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                              <input 
                                type="text"
                                placeholder="Nuovo corso..."
                                value={newCourseNames[`${student.id}-${eIdx}`] || ""}
                                onChange={(e) => setNewCourseNames({ ...newCourseNames, [`${student.id}-${eIdx}`]: e.target.value })}
                                className="w-full sm:flex-1 border rounded-2xl px-4.5 py-3 text-lg sm:text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                              />
                              <button 
                                onClick={() => handleAddCourseToEvent(student.id, eIdx)}
                                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer shadow-md"
                              >
                                <Plus size={16} /> Aggiungi Corso
                              </button>
                            </div>

                            <div className="space-y-6">
                              {event.courses.map((course, cIdx) => (
                                <div key={cIdx} className="border rounded-2xl p-6 bg-black/50 border-white/10">
                                  <div className="flex justify-between items-center mb-4">
                                    <span className="text-base sm:text-lg font-bold text-slate-100 font-playfair">
                                      Corso di {course.name}
                                    </span>
                                    <span className="text-sm font-medium text-slate-300">{course.photos.length} foto</span>
                                  </div>

                                  {course.photos.length > 0 ? (
                                    <div className="flex flex-wrap gap-4 mb-4">
                                      {course.photos.map((photoUrl, pIdx) => (
                                        <div key={pIdx} className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/15 group bg-black cursor-pointer shadow-lg">
                                          <img 
                                            src={photoUrl} 
                                            alt={`Foto ${course.name}`} 
                                            onClick={() => setZoomPhotoUrl(photoUrl)}
                                            className="w-full h-full object-cover" 
                                          />
                                          <button 
                                            onClick={() => handleDeletePhoto(student.id, eIdx, cIdx, pIdx)}
                                            className="absolute top-2 right-2 bg-black/80 text-red-400 hover:text-white p-1.5 rounded-full opacity-90 group-hover:opacity-100 transition-opacity z-10 cursor-pointer shadow"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm italic mb-4 text-slate-400">Nessuna foto in questo corso.</p>
                                  )}

                                  <div>
                                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-300">
                                      CARICA FOTO (WATERMARK AUTOMATICO)
                                    </label>
                                    <input 
                                      type="file" 
                                      multiple 
                                      accept="image/*"
                                      onChange={(e) => handleFileUpload(student.id, eIdx, cIdx, e.target.files)}
                                      className="w-full text-sm cursor-pointer file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold text-slate-200 file:bg-white/10 file:text-white hover:file:bg-white/25 transition-all"
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
        <main className="relative z-10 max-w-lg mx-auto px-6 pt-20 pb-28 flex-1 w-full flex items-center justify-center">
          <div className="border border-[#c9b074]/30 rounded-4xl p-8 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white w-full">
            <div className="text-center mb-8">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-2">
                Primo Accesso
              </span>
              <h2 className="text-4xl font-normal font-playfair">
                Benvenuto, {currentStudent.name}!
              </h2>
              <p className="text-sm mt-3 text-slate-300 leading-relaxed">
                Imposta una password definitiva e registra la tua email personale.
              </p>
            </div>

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-6">
              {passwordError && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-2xl text-sm font-medium">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                  La tua Email Personale
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={studentEmailInput} 
                    onChange={(e) => setStudentEmailInput(e.target.value)} 
                    required 
                    placeholder="nome.cognome@email.com"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-4 pl-12 text-lg sm:text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                  Nuova Password Definitiva
                </label>
                <div className="relative">
                  <input 
                    type={showNewPassword ? "text" : "password"} 
                    value={newPasswordInput} 
                    onChange={(e) => setNewPasswordInput(e.target.value)} 
                    required 
                    placeholder="Minimo 6 caratteri"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-4 pr-12 text-lg sm:text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                  Conferma Nuova Password
                </label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    value={confirmPasswordInput} 
                    onChange={(e) => setConfirmPasswordInput(e.target.value)} 
                    required 
                    placeholder="Ripeti la password"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-4 pr-12 text-lg sm:text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm sm:text-base py-4 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg mt-4 flex items-center justify-center gap-2.5"
              >
                <Check size={18} />
                <span>Salva e Accedi alla Galleria</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'forgot-password' ? (
        <main className="relative z-10 max-w-lg mx-auto px-6 pt-20 pb-28 flex-1 w-full flex items-center justify-center">
          <div className="border border-[#c9b074]/30 rounded-4xl p-8 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white w-full">
            <button 
              onClick={() => { setAuthStep('login'); setRecoveryEmail(""); }}
              className="flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-6 transition-colors cursor-pointer font-medium"
            >
              <ArrowLeft size={16} />
              <span>Torna al login</span>
            </button>

            <div className="text-center mb-8">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-2">
                Supporto Account
              </span>
              <h2 className="text-4xl font-normal font-playfair">
                Recupera Password
              </h2>
            </div>

            <form onSubmit={handlePasswordRecoverySubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                  Indirizzo Email
                </label>
                <div className="relative">
                  <input 
                    type="email" 
                    value={recoveryEmail} 
                    onChange={(e) => setRecoveryEmail(e.target.value)} 
                    required 
                    placeholder="nome.cognome@email.com"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-4 pl-12 text-lg sm:text-sm text-white focus:outline-none focus:border-[#c9b074]" 
                  />
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isRecovering}
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm sm:text-base py-4 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg mt-4 flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <Mail size={18} />
                <span>{isRecovering ? "Invio in corso..." : "Invia email di recupero"}</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'dashboard' && currentStudent ? (
        <main className="relative z-10 max-w-6xl mx-auto px-6 sm:px-8 pt-12 pb-28 flex-1 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b pb-8 border-white/10">
            <div>
              <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase mb-2 text-slate-300">
                Area Allievo
              </p>
              <h1 className="text-4xl sm:text-6xl font-normal font-playfair text-white">
                Foto di <span className="italic text-[#c9b074]">{currentStudent.name} {currentStudent.surname}</span>
              </h1>
            </div>

            <button 
              onClick={() => {
                const allPhotos = currentStudent.events.flatMap((ev) => ev.courses.flatMap((c) => c.photos));
                downloadZip(allPhotos, `saggio-${currentStudent.surname}-${currentStudent.name}`);
              }}
              disabled={isZipping || getTotalPhotosCount(currentStudent) === 0}
              className="flex items-center gap-2.5 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm sm:text-base px-6 py-3.5 rounded-full transition-all transform active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg"
            >
              <Archive size={18} />
              <span>{isZipping ? "Creazione ZIP..." : "Scarica TUTTO (.zip)"}</span>
            </button>
          </div>

          {selectedPhotos.length > 0 && (
            <div className="sticky top-6 z-40 backdrop-blur-xl border rounded-3xl p-5 mb-10 flex justify-between items-center shadow-2xl bg-slate-900/90 border-[#c9b074]/40 text-white animate-fadeIn">
              <div className="flex items-center gap-3 text-sm font-medium">
                <span className="w-8 h-8 rounded-full bg-[#c9b074] text-black font-bold flex items-center justify-center text-xs">
                  {selectedPhotos.length}
                </span>
                <span>foto selezionate</span>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedPhotos([])}
                  className="text-sm transition-colors cursor-pointer text-slate-300 hover:text-white font-medium"
                >
                  Deseleziona
                </button>

                <button 
                  onClick={() => downloadZip(selectedPhotos, `foto-selezionate-${currentStudent.surname}`)}
                  disabled={isZipping}
                  className="flex items-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm px-5 py-2.5 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-md"
                >
                  <Download size={16} />
                  <span>Scarica Selezionate (.zip)</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-12">
            {currentStudent.events.map((event, eIdx) => {
              const filteredCourses = event.courses.filter(c => selectedCourseFilter === null || c.name === selectedCourseFilter);
              if (filteredCourses.length === 0) return null;

              const allEventPhotos = filteredCourses.flatMap((c) => c.photos);
              const isAllEventSelected = allEventPhotos.length > 0 && allEventPhotos.every((p) => selectedPhotos.includes(p));
              const isMinimized = minimizedEvents[eIdx];

              return (
                <div key={eIdx} className="border-2 border-[#c9b074]/30 rounded-4xl p-8 sm:p-12 backdrop-blur-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 pb-6 border-b border-white/15">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleMinimizeEvent(eIdx)}
                        className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#c9b074] transition-all transform active:scale-95 cursor-pointer shrink-0 shadow"
                        title={isMinimized ? "Espandi evento" : "Minimizza evento"}
                      >
                        <ChevronDown size={22} className={`transition-transform duration-300 ${isMinimized ? "-rotate-90" : "rotate-0"}`} />
                      </button>

                      <div>
                        <span className="text-xs font-semibold tracking-[0.25em] uppercase text-[#c9b074] block mb-1.5">
                          Evento / Spettacolo
                        </span>
                        <h2 className="text-3xl sm:text-5xl font-normal font-playfair text-white">
                          {event.eventName}
                        </h2>
                        {event.description && (
                          <p className="text-sm sm:text-base text-slate-200 mt-3 font-light leading-relaxed">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {allEventPhotos.length > 0 && !isMinimized && (
                      <button 
                        onClick={() => toggleSelectAllPhotos(allEventPhotos)}
                        className="flex items-center gap-2 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-md"
                      >
                        {isAllEventSelected ? <CheckSquare size={18} className="text-[#c9b074]" /> : <Square size={18} />}
                        <span>{isAllEventSelected ? "Deseleziona intero evento" : "Seleziona tutto l'evento"}</span>
                      </button>
                    )}
                  </div>

                  {!isMinimized && (
                    <div className="space-y-10">
                      {filteredCourses.map((course, cIdx) => {
                        const isAllCourseSelected = course.photos.length > 0 && course.photos.every((p) => selectedPhotos.includes(p));

                        return (
                          <div key={cIdx} className="border border-[#c9b074]/20 rounded-3xl p-6 sm:p-8 bg-black/40 backdrop-blur-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
                              <h3 className="text-2xl sm:text-3xl font-normal font-playfair flex items-center gap-3.5 text-white">
                                <span className="w-3 h-3 rounded-full bg-[#c9b074]"></span>
                                Corso di {course.name}
                              </h3>

                              {course.photos.length > 0 && (
                                <button 
                                  onClick={() => toggleSelectAllPhotos(course.photos)}
                                  className="flex items-center gap-2 text-sm text-slate-200 hover:text-white transition-colors cursor-pointer font-medium"
                                >
                                  {isAllCourseSelected ? <CheckSquare size={18} className="text-[#c9b074]" /> : <Square size={18} />}
                                  <span>{isAllCourseSelected ? "Deseleziona corso" : "Seleziona corso"}</span>
                                </button>
                              )}
                            </div>

                            {course.photos.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
                                {course.photos.map((photoUrl, pIdx) => {
                                  const isSelected = selectedPhotos.includes(photoUrl);

                                  return (
                                    <div 
                                      key={pIdx} 
                                      className={`relative group rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 aspect-square bg-black shadow-lg ${
                                        isSelected 
                                          ? "border-[#c9b074] ring-4 ring-[#c9b074]/50 scale-[1.02]" 
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
                                        <span className="bg-black/75 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 border border-white/20 shadow-xl font-medium">
                                          <ZoomIn size={16} className="text-[#c9b074]" /> Ingrandisci
                                        </span>
                                      </div>

                                      <div 
                                        onClick={(e) => { e.stopPropagation(); togglePhotoSelection(photoUrl); }}
                                        className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10"
                                      >
                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
                                          isSelected ? "bg-[#c9b074] text-black shadow-md scale-110" : "bg-black/60 border border-white/40 text-transparent hover:border-white"
                                        }`}>
                                          <Check size={16} className="stroke-[3]" />
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
                                        className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-black/70 hover:bg-[#c9b074] hover:text-black text-white p-2.5 rounded-full transition-colors shadow-xl z-20 cursor-pointer"
                                      >
                                        <Download size={15} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-base italic text-slate-400">Nessuna foto disponibile per questo corso.</p>
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
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-11 sm:py-5 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20">
          
          <div className="w-full lg:w-7/12 flex flex-col items-center lg:items-start text-center lg:text-left space-y-8">
            <span className="text-xs sm:text-sm font-semibold tracking-[0.4em] uppercase text-[#c9b074]">
              NUOVA ACCADEMIA TOSCANINI
            </span>
            <h1 className="text-6xl sm:text-6xl lg:text-8xl font-normal leading-[1.1] tracking-tight font-playfair text-white">
              Accedi alla tua <br />
              <span className="italic font-normal bg-gradient-to-r from-white via-[#c9b074] to-slate-300 bg-clip-text text-transparent drop-shadow-sm">Galleria Privata</span>
            </h1>
            <p className="text-lg sm:text-0xl max-w-2xl font-normal leading-relaxed text-slate-200">
              Inserisci le credenziali ufficiali fornite dalla segreteria dell'accademia per esplorare, selezionare e scaricare i tuoi ricordi in alta definizione.
            </p>
          </div>

          <div className="w-full lg:w-5/12 max-w-md">
            <div className="border border-[#c9b074]/30 rounded-4xl p-8 sm:p-10 backdrop-blur-2xl bg-gradient-to-b from-slate-900/75 to-slate-950/95 shadow-[0_16px_48px_rgba(0,0,0,0.6)] relative overflow-hidden">
              
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#c9b074]/70 to-transparent"></div>

              <form onSubmit={handleStudentLoginSubmit} className="space-y-6">
                {loginError && (
                  <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-2xl text-sm font-medium">
                    {loginError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    Nome
                  </label>
                  <input 
                    type="text" 
                    value={loginName} 
                    onChange={(e) => setLoginName(e.target.value)} 
                    required 
                    placeholder="es. Mario"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-lg sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    Cognome
                  </label>
                  <input 
                    type="text" 
                    value={loginSurname} 
                    onChange={(e) => setLoginSurname(e.target.value)} 
                    required 
                    placeholder="es. Rossi"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3 text-lg sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                    Password
                  </label>
                  <div className="relative">
                    <input 
                      type={showLoginPassword ? "text" : "password"} 
                      value={loginPassword} 
                      onChange={(e) => setLoginPassword(e.target.value)} 
                      required 
                      placeholder="••••••••••••••••••••••••"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-4 pr-12 text-lg sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={loginLoading}
                    className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm sm:text-base py-4 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Accesso in corso...</span>
                      </>
                    ) : (
                      <>
                        <Unlock size={16} />
                        <span>Accedi alla galleria</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-6 border-t border-white/10 flex flex-col items-center gap-3 text-center">
                  <button 
                    type="button"
                    onClick={() => setAuthStep('forgot-password')}
                    className="text-sm text-[#c9b074] hover:underline cursor-pointer font-semibold"
                  >
                    Hai dimenticato la password? Recuperala qui
                  </button>
                  <p className="text-xs text-slate-300 font-light leading-relaxed">
                    Se non è ancora avvenuto il cambio password andare in segreteria per prendersi la password.
                  </p>
                </div>

              </form>
            </div>
          </div>

        </main>
      )}

      {isFaqModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="border border-[#c9b074]/30 rounded-4xl p-8 sm:p-10 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl transition-colors backdrop-blur-2xl bg-slate-950/90 text-white">
            <button 
              onClick={() => setIsFaqModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full transition-colors cursor-pointer text-slate-300 hover:text-white bg-white/5 hover:bg-white/10"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-2 text-[#c9b074]">
                Guida e Assistenza
              </p>
              <h2 className="text-4xl font-normal font-playfair text-white">
                FAQ - <span className="italic text-[#c9b074]">Hai bisogno di aiuto?</span>
              </h2>
              <p className="text-sm text-slate-300 mt-2">
                Tutte le risposte e le istruzioni per accedere e utilizzare la galleria fotografica.
              </p>
            </div>

            <div className="space-y-5 text-sm text-slate-200 leading-relaxed">
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-base font-bold text-white mb-2 font-playfair flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074]"></span>
                  1. Come entrare (Primo Accesso)
                </h3>
                <p>
                  Per effettuare il primo accesso, inserisci nella schermata principale il <strong>Nome</strong> e il <strong>Cognome</strong> dell'allievo insieme alla <strong>password provvisoria</strong> fornita dalla segreteria dell'accademia.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-base font-bold text-white mb-2 font-playfair flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074]"></span>
                  2. Registrazione e configurazione account
                </h3>
                <p>
                  Al primo login il sistema richiederà di completare la configurazione inserendo un <strong>indirizzo email personale</strong> e impostando una <strong>nuova password definitiva</strong> (di almeno 6 caratteri). Questo metterà in sicurezza il profilo per gli accessi futuri.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-base font-bold text-white mb-2 font-playfair flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074]"></span>
                  3. Cosa fare se si perde la password
                </h3>
                <p>
                  Nella schermata di accesso, clicca sul link <strong>"Hai dimenticato la password? Recuperala qui"</strong>, inserisci la tua email registrata per ricevere le istruzioni di recupero, oppure contatta direttamente la segreteria dell'accademia per un reset rapido.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h3 className="text-base font-bold text-white mb-2 font-playfair flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074]"></span>
                  4. Come accedere alla galleria e scaricare le foto
                </h3>
                <p>
                  Una volta dentro la dashboard, potrai visualizzare tutti gli spettacoli e i corsi dell'allievo. Clicca su qualsiasi foto per ingrandirla, oppure seleziona le foto desiderate (o l'intero evento) per scaricarle rapidamente in formato <strong>ZIP</strong> con un unico click.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <button 
                onClick={() => setIsFaqModalOpen(false)}
                className="bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm sm:text-base py-3 px-8 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg"
              >
                Ho capito, chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {zoomPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-between p-6 sm:p-10 animate-fadeIn"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div 
            className="w-full max-w-6xl flex justify-between items-center z-10 pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm text-slate-300 font-mono tracking-wider">
              ANTEPRIMA IMMAGINE
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  const shareText = "Guarda questa foto del mio saggio all'Accademia Toscanini!";
                  if (navigator.share) {
                    navigator.share({ title: "Accademia Toscanini", text: shareText, url: zoomPhotoUrl }).catch(() => {});
                  } else {
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + zoomPhotoUrl)}`, '_blank');
                  }
                }}
                className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm px-5 py-2.5 rounded-full transition-all cursor-pointer"
              >
                <Share2 size={16} />
                <span>Condividi</span>
              </button>

              <button 
                onClick={() => handleDownloadSinglePhoto(zoomPhotoUrl, "foto-saggio-nat.jpg")}
                className="flex items-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm px-5 py-2.5 rounded-full transition-all transform active:scale-95 cursor-pointer shadow-lg"
              >
                <Download size={16} />
                <span>Scarica</span>
              </button>

              <button 
                onClick={() => setZoomPhotoUrl(null)}
                className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div 
            className="relative max-w-6xl max-h-[80vh] my-auto flex items-center justify-center overflow-hidden rounded-3xl border border-white/10 shadow-2xl bg-slate-900/50 backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={zoomPhotoUrl} 
              alt="Anteprima foto ingrandita" 
              className="max-w-full max-h-[80vh] object-contain select-none"
            />
          </div>

          <p className="text-slate-400 text-sm italic z-10 pb-2">
            Clicca in un punto qualsiasi fuori dalla foto per chiudere
          </p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="border border-[#c9b074]/30 rounded-4xl p-8 sm:p-10 max-w-md w-full relative shadow-2xl transition-colors backdrop-blur-2xl bg-slate-950/90 text-white">
            <button 
              onClick={() => { setIsModalOpen(false); setAdminPasswordError(false); setShowAdminPassword(false); setAdminPasswordInput(""); }}
              className="absolute top-6 right-6 p-2 rounded-full transition-colors cursor-pointer text-slate-300 hover:text-white bg-white/5 hover:bg-white/10"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-2 text-slate-300">
                RISERVATO ALLO STAFF
              </p>
              <h2 className="text-4xl sm:text-5xl font-normal font-playfair text-white">
                Area <span className="italic text-[#c9b074]">Riservata</span>
              </h2>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2.5 text-slate-200">
                  PASSWORD AMMINISTRATORE
                </label>
                <div className="relative">
                  <input 
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    className={`w-full border rounded-2xl px-5 py-4 pr-12 text-lg sm:text-base focus:outline-none transition-colors ${
                      adminPasswordError 
                        ? "border-red-500 bg-black/50 text-white" 
                        : "bg-black/50 border-white/15 text-white placeholder-slate-500 focus:border-[#c9b074]"
                    }`}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {adminPasswordError && (
                  <p className="text-red-400 text-sm mt-2 font-medium">
                    Password errata. Riprova.
                  </p>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-base py-4 px-6 rounded-full flex items-center justify-center gap-2.5 transition-all transform active:scale-95 duration-200 cursor-pointer shadow-lg mt-2"
              >
                <Lock size={18} />
                <span>Entra</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}