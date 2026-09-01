"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Lock, LogOut, Plus, Trash2, Key, X, 
  Download, Unlock, CheckSquare, Square, Archive, Check, ZoomIn, FolderPlus,
  Eye, EyeOff, Mail, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, HelpCircle, Loader2,
  FileSpreadsheet, FileText, Copy, Share2, Filter,
  Upload, Users, ShieldAlert, UserCheck, Sparkles, Edit3
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
  email?: string | null;
  password?: string;
  has_changed_password?: boolean;
  is_minor?: boolean;
  parent_name?: string | null;
  parent_email?: string | null;
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

    const MAX_DIM = 4096; // Gestione reale fino al 4K senza sgranature
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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

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
        1.0 // Qualità massima assoluta
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export default function Page() {
  const [authStep, setAuthStep] = useState<'login' | 'change-password' | 'dashboard'>('login');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);

  const [loginName, setLoginName] = useState("");
  const [loginSurname, setLoginSurname] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [parentNameInput, setParentNameInput] = useState("");
  const [parentEmailInput, setParentEmailInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [applyWatermarkEnabled, setApplyWatermarkEnabled] = useState(true);

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
  const [newNumber, setNewNumber] = useState("");
  const [newIsMinor, setNewIsMinor] = useState(false);
  const [newEventoInput, setNewEventoInput] = useState("");
  const [newEventoDescInput, setNewEventoDescInput] = useState("");
  const [newCorsiInput, setNewCorsiInput] = useState("");

  const [newEventNames, setNewEventNames] = useState<{ [studentId: string]: string }>({});
  const [newEventDescriptions, setNewEventDescriptions] = useState<{ [studentId: string]: string }>({});
  const [newCourseNames, setNewCourseNames] = useState<{ [key: string]: string }>({});
  const [eventDescInputs, setEventDescInputs] = useState<{ [key: string]: string }>({});
  const [editingCourseInputs, setEditingCourseInputs] = useState<{ [key: string]: string }>({});

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
  };

  const handleNextPhoto = () => {
    if (activePhotosList.length === 0) return;
    const nextIndex = (zoomCurrentIndex + 1) % activePhotosList.length;
    setZoomCurrentIndex(nextIndex);
    setZoomPhotoUrl(activePhotosList[nextIndex]);
  };

  const handlePrevPhoto = () => {
    if (activePhotosList.length === 0) return;
    const prevIndex = (zoomCurrentIndex - 1 + activePhotosList.length) % activePhotosList.length;
    setZoomCurrentIndex(prevIndex);
    setZoomPhotoUrl(activePhotosList[prevIndex]);
  };

  const toggleMinimizeEvent = (eIdx: number) => {
    setMinimizedEvents(prev => ({ ...prev, [eIdx]: !prev[eIdx] }));
  };

  const toggleMinimizeStudent = (studentId: string) => {
    setMinimizedStudents(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const configuredAdminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (configuredAdminPassword && adminPasswordInput === configuredAdminPassword) {
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
        .single();

      if (error || !data) {
        setLoginError("Allievo non trovato. Controlla nome e cognome inseriti.");
        toast.error("Allievo non trovato");
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

      if (formattedStudent.has_changed_password === true) {
        setAuthStep('dashboard');
        toast.success(`Benvenuto, ${formattedStudent.name}!`);
      } else {
        setAuthStep('change-password');
        setParentNameInput(formattedStudent.parent_name || "");
        setParentEmailInput(formattedStudent.parent_email || "");
        toast.info("Primo accesso: configura i tuoi dati");
      }

      setLoginName("");
      setLoginSurname("");
    } catch {
      setLoginError("Si è verificato un errore durante l'accesso.");
      toast.error("Errore di connessione");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentStudent) return;

    if (currentStudent.is_minor) {
      if (!parentNameInput.trim() || !parentEmailInput.trim()) {
        setPasswordError("Trattandosi di un allievo minorenne, è obbligatorio inserire i dati del genitore o tutore legale.");
        toast.error("Dati genitore obbligatori");
        return;
      }
    }

    const updatePayload = currentStudent.is_minor ? {
      parent_name: parentNameInput.trim(),
      parent_email: parentEmailInput.trim(),
      has_changed_password: true
    } : {
      parent_name: null,
      parent_email: null,
      has_changed_password: true
    };

    try {
      const { error } = await supabase
        .from("students")
        .update(updatePayload)
        .eq("id", currentStudent.id);

      if (error) throw error;

      setCurrentStudent({ 
        ...currentStudent, 
        parent_name: updatePayload.parent_name || undefined,
        parent_email: updatePayload.parent_email || undefined,
        has_changed_password: true 
      });
      
      setAuthStep('dashboard');
      setSelectedPhotos([]);
      setParentNameInput("");
      setParentEmailInput("");
      toast.success("Dati configurati con successo!");
    } catch {
      setPasswordError("Errore durante il salvataggio dei dati.");
      toast.error("Errore durante il salvataggio");
    }
  };

  const handleResetStudentPassword = async (student: Student) => {
    const { error } = await supabase
      .from("students")
      .update({ 
        has_changed_password: false,
        password: crypto.randomUUID() 
      })
      .eq("id", student.id);

    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }

    toast.success(`Stato di primo accesso ripristinato per ${student.name}`);
    fetchStudents();
  };

  const handleBulkInsert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInputText.trim()) return;

    const lines = bulkInputText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const newStudentsPayload: any[] = [];
    let count = 0;

    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 2) continue;

      const [nome, cognome, isMinorRaw, parentEmailVal, corsoVal, eventoVal] = parts;
      const isMinor = isMinorRaw?.toLowerCase() === "si" || isMinorRaw?.toLowerCase() === "sì" || isMinorRaw?.toLowerCase() === "true";
      const initials = `${nome[0] || ""}${cognome[0] || ""}`.toUpperCase();

      const coursesList = (corsoVal || "Generale")
        .split(";")
        .map(c => ({ name: c.trim(), photos: [] }));

      newStudentsPayload.push({
        id: crypto.randomUUID(),
        initials,
        name: nome,
        surname: cognome,
        number: "N/D",
        password: crypto.randomUUID(),
        has_changed_password: false,
        is_minor: isMinor,
        parent_name: isMinor ? "Genitore" : null,
        parent_email: isMinor ? (parentEmailVal || null) : null,
        courses: coursesList,
        events: [{ 
          eventName: eventoVal || "Saggio Principale", 
          description: "Saggio di fine anno accademico", 
          courses: coursesList 
        }]
      });
      count++;
    }

    if (newStudentsPayload.length === 0) {
      toast.error("Formato dati non valido.");
      return;
    }

    const { error } = await supabase.from("students").insert(newStudentsPayload);
    if (error) {
      toast.error(`Errore durante l'importazione: ${error.message}`);
    } else {
      toast.success(`Importati con successo ${count} allievi!`);
      setBulkInputText("");
      setIsBulkModalOpen(false);
      fetchStudents();
    }
  };

  const exportStudentsCSV = () => {
    const headers = ["Nome", "Cognome", "Minorenne", "Genitore", "Email Genitore", "Primo Accesso Fatto"];
    const rows = students.map(s => [
      s.name, 
      s.surname, 
      s.is_minor ? "Sì" : "No", 
      s.parent_name || "", 
      s.parent_email || "", 
      s.has_changed_password ? "Sì" : "No"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "elenco_allievi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Esportazione CSV completata!");
  };

  const exportStudentsTXT = () => {
    const textContent = students.map(s => `Nome: ${s.name} | Cognome: ${s.surname} | Minorenne: ${s.is_minor ? 'Sì (Genitore: ' + (s.parent_name || 'N/D') + ' - ' + (s.parent_email || 'N/D') + ')' : 'No'} | Primo Accesso Completato: ${s.has_changed_password ? "Sì" : "No"}`).join("\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "elenco_allievi.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Esportazione TXT completata!");
  };

  const copyStudentsToClipboard = () => {
    const textContent = students.map(s => `${s.name} ${s.surname} ${s.is_minor ? '(Minorenne - Genitore: ' + (s.parent_name || 'N/D') + ')' : '(Maggiorenne)'} - Primo Accesso: ${s.has_changed_password ? "Completato" : "Da fare"}`).join("\n");
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
      toast.success("Download completato in alta definizione");
    } catch {
      window.open(photoUrl, "_blank");
    }
  };

  const downloadZip = async (photosToDownload: string[], zipFilename: string) => {
    if (photosToDownload.length === 0) return;
    setIsZipping(true);
    toast.info("Generazione archivio ZIP in corso (massima qualità)...");

    try {
      const zip = new JSZip();
      const folder = zip.folder("foto-saggio-alta-definizione");

      for (let i = 0; i < photosToDownload.length; i++) {
        const url = photosToDownload[i];
        if (url.startsWith("data:")) {
          const base64Data = url.split(",")[1] || url;
          folder?.file(`foto-4k-${i + 1}.jpg`, base64Data, { base64: true });
        } else {
          const response = await fetch(url);
          const blob = await response.blob();
          folder?.file(`foto-4k-${i + 1}.jpg`, blob);
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
    
    const newStudent = {
      id: crypto.randomUUID(),
      initials,
      name: newNome.trim(),
      surname: newCognome.trim(),
      number: newNumber.trim() || "N/D",
      password: crypto.randomUUID(),
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
      { eventName, description: eventDescription, courses: [{ name: "Sezione Principale", photos: [] }] }
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
      toast.success("Sezione aggiunta!");
      fetchStudents();
    }
  };

  const handleRenameCourse = async (studentId: string, eventIndex: number, courseIndex: number) => {
    const key = `${studentId}-${eventIndex}-${courseIndex}`;
    const newName = editingCourseInputs[key]?.trim();
    if (!newName) return;

    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const updatedEvents = targetStudent.events.map((ev, eIdx) => {
      if (eIdx === eventIndex) {
        const updatedCourses = ev.courses.map((c, cIdx) => {
          if (cIdx === courseIndex) {
            return { ...c, name: newName };
          }
          return c;
        });
        return { ...ev, courses: updatedCourses };
      }
      return ev;
    });

    const { error } = await supabase.from("students").update({ events: updatedEvents }).eq("id", studentId);
    if (!error) {
      toast.success("Nome aggiornato con successo!");
      fetchStudents();
    } else {
      toast.error(`Errore: ${error.message}`);
    }
  };

  const handleFileUpload = async (studentId: string, eventIndex: number, courseIndex: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const targetStudent = students.find((s) => s.id === studentId);
    if (!targetStudent) return;

    const studentFolderName = `${targetStudent.surname}_${targetStudent.name}`.toLowerCase().trim().replace(/\s+/g, "_");
    const targetCourse = targetStudent.events[eventIndex]?.courses[courseIndex]?.name || "Sezione";
    const courseFolderName = targetCourse.trim().replace(/\s+/g, "_");

    const fileArray = Array.from(files);
    
    toast.info(applyWatermarkEnabled ? "Elaborazione foto 4K con watermark..." : "Caricamento foto 4K originali su Drive...");

    const uploadPromises = fileArray.map(async (file) => {
      try {
        let fileToUpload: Blob = file;

        if (applyWatermarkEnabled) {
          fileToUpload = await applyWatermark(file, "/logo.png");
        }

        const formData = new FormData();
        formData.append("file", fileToUpload, file.name);
        formData.append("studentName", studentFolderName);
        formData.append("courseName", courseFolderName);

        const res = await fetch("/api/drive-upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        return data.success ? data.fileUrl : null;
      } catch (err) {
        console.error("Errore upload file su Drive:", err);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const uploadedUrls = results.filter((url): url is string => url !== null);

    if (uploadedUrls.length === 0) {
      toast.error("Nessuna foto caricata su Google Drive");
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
      toast.success("Foto 4K caricate e organizzate su Google Drive!");
      fetchStudents();
    } else {
      toast.error(`Errore salvataggio link: ${error.message}`);
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
    const parentMatch = st.parent_name?.toLowerCase().includes(query) || st.parent_email?.toLowerCase().includes(query) || false;
    return fullName.includes(query) || parentMatch;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
        <div className="absolute -top-32 -left-32 w-120 h-120 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-120 h-120 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
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

      <div className="absolute -top-40 -left-40 w-120 h-120 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-120 h-120 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-120 h-120 bg-[#c9b074]/10 rounded-full blur-[120px] pointer-events-none" />

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
        .font-playfair {
          font-family: 'Playfair Display', Georgia, serif;
        }
      `}</style>

      {/* Header Principale */}
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
              className="h-full w-auto object-contain drop-shadow-[0_4px_13px_rgba(201,176,116,0.2)] brightness-110"
              priority
            />
          </div>
        </div>

        <div className="flex items-center justify-end flex-1 gap-2">
          {isAdmin ? (
            <button 
              onClick={() => { setIsAdmin(false); toast.info("Uscito dall'area staff"); }}
              className="flex items-center gap-2 px-4 py-2 border rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform active:scale-95 cursor-pointer bg-white/5 hover:bg-white/10 border-white/15 text-white shadow-sm"
            >
              <LogOut size={15} className="text-red-400" />
              <span className="hidden sm:inline">Esci Staff</span>
            </button>
          ) : authStep === 'dashboard' && currentStudent ? (
            <button 
              onClick={() => { setCurrentStudent(null); setAuthStep('login'); setSelectedPhotos([]); toast.info("Sessione chiusa"); }}
              className="flex items-center gap-2 px-3.5 py-2 border rounded-full text-xs sm:text-sm font-medium transition-all duration-200 transform active:scale-95 cursor-pointer bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-white shadow-sm"
            >
              <LogOut size={15} className="text-red-400" />
              <span className="truncate max-w-25 sm:max-w-none">Esci ({currentStudent.name})</span>
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
        /* PANNELLO STAFF / ADMIN */
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-28 flex-1 w-full">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} className="text-[#c9b074]" />
                <span className="text-xs font-semibold tracking-[0.25em] uppercase text-[#c9b074]">Pannello Direzione</span>
              </div>
              <h1 className="text-3xl sm:text-6xl font-normal font-playfair text-white leading-tight">
                Gestione Allievi
              </h1>
              <p className="text-xs sm:text-base text-slate-300 italic mt-1">
                L'elenco allievi è ordinato automaticamente in ordine alfabetico per cognome. Gestione basata su eventi e sezioni.
              </p>
            </div>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-xs sm:text-sm px-6 py-3.5 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-xl border border-[#c9b074]/50"
            >
              <Upload size={18} />
              <span>Inserimento Multiplo (Bulk)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
            <div className="border border-[#c9b074]/25 rounded-3xl p-6 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <span className="text-xs uppercase tracking-widest text-slate-400">Allievi Totali</span>
              <p className="text-3xl font-playfair font-normal text-white mt-2">{students.length}</p>
            </div>
            <div className="border border-[#c9b074]/25 rounded-3xl p-6 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <span className="text-xs uppercase tracking-widest text-slate-400">Primo Accesso Effettuato</span>
              <p className="text-3xl font-playfair font-normal text-[#c9b074] mt-2">
                {students.filter(s => s.has_changed_password).length} / {students.length}
              </p>
            </div>
            <div className="border border-[#c9b074]/25 rounded-3xl p-6 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <span className="text-xs uppercase tracking-widest text-slate-400">Foto Totali Caricate</span>
              <p className="text-3xl font-playfair font-normal text-white mt-2">
                {students.reduce((acc, st) => acc + getTotalPhotosCount(st), 0)}
              </p>
            </div>
          </div>

          {/* Export Box */}
          <div className="border border-[#c9b074]/25 rounded-4xl p-6 sm:p-8 mb-10 backdrop-blur-2xl bg-linear-to-b from-slate-900/60 to-slate-950/85 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl sm:text-2xl font-playfair font-normal text-white mb-1">Esportazione Elenco Segreteria</h3>
              <p className="text-xs sm:text-sm text-slate-300">Scarica o copia la lista completa degli allievi registrati.</p>
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

          {/* Form Singolo Allievo */}
          <div className="border border-[#c9b074]/25 rounded-4xl p-6 sm:p-10 mb-10 backdrop-blur-2xl bg-linear-to-b from-slate-900/60 to-slate-950/85 shadow-xl">
            <h2 className="text-2xl sm:text-4xl font-normal mb-2 font-playfair text-white">
              Aggiungi Allievo Singolo
            </h2>
            <p className="text-xs sm:text-sm mb-6 font-light text-slate-300">
              Inserisci i dati per registrare un singolo allievo.
            </p>

            <form onSubmit={handleCreateStudent} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
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
                <div className="sm:col-span-1.5 md:col-span-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">DESCRIZIONE EVENTO</label>
                  <input 
                    type="text" 
                    value={newEventoDescInput}
                    onChange={(e) => setNewEventoDescInput(e.target.value)}
                    placeholder="Concerto accademico..."
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div className="sm:col-span-1.5 md:col-span-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">SEZIONI / CORSI (SEPARATI DA VIRGOLA)</label>
                  <input 
                    type="text" 
                    value={newCorsiInput}
                    onChange={(e) => setNewCorsiInput(e.target.value)}
                    placeholder="Pianoforte, Canto"
                    className="w-full border rounded-2xl px-4 py-3 text-sm focus:outline-none transition-colors bg-black/50 border-white/15 text-white placeholder-slate-600 focus:border-[#c9b074]"
                  />
                </div>
                <div className="sm:col-span-3 flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox"
                    id="newIsMinor"
                    checked={newIsMinor}
                    onChange={(e) => setNewIsMinor(e.target.checked)}
                    className="w-5 h-5 accent-[#c9b074] rounded cursor-pointer"
                  />
                  <label htmlFor="newIsMinor" className="text-xs font-semibold uppercase tracking-widest text-slate-200 cursor-pointer">
                    Allievo Minorenne (Account collegato a Genitore/Tutore)
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
              placeholder="Cerca allievo per nome, cognome o genitore..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              className="w-full px-5 py-3.5 rounded-3xl backdrop-blur-xl bg-slate-900/60 border border-[#c9b074]/25 text-white placeholder-slate-400 focus:outline-none focus:border-[#c9b074] transition-colors text-sm shadow-xl"
            />
          </div>

          {/* Lista Allievi Staff */}
          <div className="space-y-6">
            {filteredStaffStudents.map((student) => {
              const isStudentMinimized = minimizedStudents[student.id];
              return (
                <div key={student.id} className="border border-[#c9b074]/25 rounded-4xl p-6 sm:p-8 backdrop-blur-2xl bg-linear-to-b from-slate-900/60 to-slate-950/85 shadow-xl transition-all">
                  <div 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer select-none"
                    onClick={() => toggleMinimizeStudent(student.id)}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl sm:text-3xl font-normal font-playfair text-white">
                          {student.surname} {student.name}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${student.is_minor ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                          {student.is_minor ? <ShieldAlert size={12} /> : <UserCheck size={12} />}
                          {student.is_minor ? 'Minorenne (Account Genitore)' : 'Maggiorenne'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-xs sm:text-sm font-mono mt-2 text-slate-300">
                        {student.is_minor && (
                          <div className="flex items-center gap-2 text-amber-200/90 font-sans text-xs">
                            <span>Genitore/Tutore: <strong>{student.parent_name || 'Non specificato'}</strong> ({student.parent_email || 'Nessuna email'})</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Stato primo accesso: {student.has_changed_password ? <strong className="text-emerald-400">Completato</strong> : <strong className="text-amber-400">Da fare</strong>}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleResetStudentPassword(student)}
                          className="flex items-center gap-1.5 border border-[#c9b074]/40 text-[#c9b074] hover:bg-[#c9b074]/10 text-xs px-3.5 py-2 rounded-full transition-all active:scale-95 cursor-pointer font-medium"
                          title="Permette all'allievo di rifare la configurazione iniziale al prossimo accesso"
                        >
                          <Key size={14} />
                          <span>Reset Primo Accesso</span>
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
                                placeholder="Nuova Sezione / Corso..."
                                value={newCourseNames[`${student.id}-${eIdx}`] || ""}
                                onChange={(e) => setNewCourseNames({ ...newCourseNames, [`${student.id}-${eIdx}`]: e.target.value })}
                                className="w-full sm:flex-1 border rounded-xl px-3.5 py-2 text-sm bg-black/50 border-white/15 text-white focus:outline-none focus:border-[#c9b074]"
                              />
                              <button 
                                onClick={() => handleAddCourseToEvent(student.id, eIdx)}
                                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              >
                                <Plus size={14} /> Aggiungi Sezione
                              </button>
                            </div>

                            <div className="space-y-4">
                              {event.courses.map((course, cIdx) => (
                                <div key={cIdx} className="border rounded-2xl p-4 bg-black/50 border-white/10">
                                  
                                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 pb-3 border-b border-white/5">
                                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                                      <input 
                                        type="text"
                                        defaultValue={course.name}
                                        placeholder="Nome sezione..."
                                        onChange={(e) => setEditingCourseInputs({ ...editingCourseInputs, [`${student.id}-${eIdx}-${cIdx}`]: e.target.value })}
                                        className="w-full sm:w-64 bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#c9b074]"
                                      />
                                      <button
                                        onClick={() => handleRenameCourse(student.id, eIdx, cIdx)}
                                        className="flex items-center gap-1 bg-[#c9b074]/20 hover:bg-[#c9b074]/30 border border-[#c9b074]/40 text-[#c9b074] text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer font-medium shrink-0"
                                        title="Rinomina Sezione"
                                      >
                                        <Edit3 size={13} />
                                        <span>Rinomina</span>
                                      </button>
                                    </div>
                                    <span className="text-xs text-slate-300 shrink-0">{course.photos.length} foto 4K</span>
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
                                    <p className="text-xs italic mb-3 text-slate-400">Nessuna foto in questa sezione.</p>
                                  )}

                                  <div className="flex items-center gap-2 mb-3 pt-1">
                                    <input 
                                      type="checkbox"
                                      id={`wm-${student.id}-${eIdx}-${cIdx}`}
                                      checked={applyWatermarkEnabled}
                                      onChange={(e) => setApplyWatermarkEnabled(e.target.checked)}
                                      className="w-4 h-4 accent-[#c9b074] rounded cursor-pointer"
                                    />
                                    <label 
                                      htmlFor={`wm-${student.id}-${eIdx}-${cIdx}`} 
                                      className="text-xs text-slate-300 cursor-pointer select-none font-medium"
                                    >
                                      Applica watermark con logo in alta definizione
                                    </label>
                                  </div>

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
        /* PRIMO ACCESSO */
        <main className="relative z-10 max-w-lg mx-auto px-4 pt-16 pb-28 flex-1 w-full flex items-center justify-center">
          <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 backdrop-blur-2xl bg-linear-to-b from-slate-900/60 to-slate-950/85 shadow-2xl text-white w-full">
            <div className="text-center mb-6">
              <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#c9b074] block mb-2">Primo Accesso</span>
              <h2 className="text-3xl font-normal font-playfair">
                {currentStudent.is_minor ? `Configurazione Genitore per: ${currentStudent.name} ${currentStudent.surname}` : `Benvenuto, ${currentStudent.name}!`}
              </h2>
              <p className="text-xs sm:text-sm mt-2 text-slate-300">
                {currentStudent.is_minor 
                  ? "Trattandosi di un allievo minorenne, inserisci i dati del genitore o tutore legale." 
                  : "Conferma l'accesso alla tua galleria privata."}
              </p>
            </div>

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-2xl text-xs font-medium">
                  {passwordError}
                </div>
              )}

              {currentStudent.is_minor && (
                <div className="space-y-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#c9b074]">
                    Informazioni Genitore / Tutore Legale
                  </h3>
                  
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">
                      Nome e Cognome del Genitore
                    </label>
                    <input
                      type="text"
                      required
                      value={parentNameInput}
                      onChange={(e) => setParentNameInput(e.target.value)}
                      placeholder="es. Maria Rossi"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-[#c9b074]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">
                      Email Genitore
                    </label>
                    <input
                      type="email"
                      required
                      value={parentEmailInput}
                      onChange={(e) => setParentEmailInput(e.target.value)}
                      placeholder="genitore@example.com"
                      className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-[#c9b074]"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-3.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg mt-4 flex items-center justify-center gap-2"
              >
                <Check size={16} />
                <span>Accedi alla Galleria</span>
              </button>
            </form>
          </div>
        </main>
      ) : authStep === 'dashboard' && currentStudent ? (
        /* AREA ALLIEVO */
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-32 flex-1 w-full">
          
          <div className="bg-linear-to-r from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-[#c9b074]/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c9b074] animate-pulse" />
                <span className="text-xs font-semibold tracking-[0.25em] uppercase text-[#c9b074]">
                  {currentStudent.is_minor ? "Area Genitore / Tutore Legale" : "Area Allievo Riservata"}
                </span>
              </div>

              {currentStudent.is_minor ? (
                <div>
                  <h1 className="text-3xl sm:text-5xl font-normal font-playfair text-white">
                    Foto di <span className="italic text-[#c9b074]">{currentStudent.name} {currentStudent.surname}</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Account genitore collegato: <strong className="text-white">{currentStudent.parent_name || 'Genitore'}</strong> ({currentStudent.parent_email})
                  </p>
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl sm:text-5xl font-normal font-playfair text-white">
                    Galleria Personale di <span className="italic text-[#c9b074]">{currentStudent.name} {currentStudent.surname}</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Benvenuto nel tuo spazio riservato dell'Accademia Toscanini.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button 
                onClick={() => {
                  const allPhotos = currentStudent.events.flatMap((ev) => ev.courses.flatMap((c) => c.photos));
                  downloadZip(allPhotos, `saggio-${currentStudent.surname}-${currentStudent.name}`);
                }}
                disabled={isZipping || getTotalPhotosCount(currentStudent) === 0}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm px-6 py-3.5 rounded-2xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-lg"
              >
                <Archive size={18} />
                <span>{isZipping ? "Creazione ZIP..." : "Scarica Tutte le Foto 4K (.zip)"}</span>
              </button>
            </div>
          </div>

          {/* Filtro Rapido per Sezione */}
          {(() => {
            const allCourses = Array.from(
              new Set(currentStudent.events.flatMap(e => e.courses.map(c => c.name)))
            );
            if (allCourses.length <= 1) return null;

            return (
              <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-2 shrink-0 uppercase tracking-wider">
                  <Filter size={14} className="text-[#c9b074]" /> Filtra Sezione:
                </span>
                <button
                  onClick={() => setSelectedCourseFilter(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    selectedCourseFilter === null 
                      ? "bg-[#c9b074] text-black font-bold shadow-md" 
                      : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Tutte
                </button>
                {allCourses.map((courseName) => (
                  <button
                    key={courseName}
                    onClick={() => setSelectedCourseFilter(courseName)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                      selectedCourseFilter === courseName 
                        ? "bg-[#c9b074] text-black font-bold shadow-md" 
                        : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {courseName}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* Barra Fluttuante per Selezione Multipla Foto */}
          {selectedPhotos.length > 0 && (
            <div className="sticky top-6 z-40 backdrop-blur-2xl border rounded-2xl p-4 mb-8 flex justify-between items-center shadow-2xl bg-slate-900/90 border-[#c9b074]/50 text-white animate-fadeIn">
              <div className="flex items-center gap-3 text-xs sm:text-sm font-medium">
                <span className="w-8 h-8 rounded-xl bg-[#c9b074] text-black font-bold flex items-center justify-center text-xs shadow-md">
                  {selectedPhotos.length}
                </span>
                <span>foto selezionate</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedPhotos([])} 
                  className="text-xs text-slate-400 hover:text-white font-medium cursor-pointer transition-colors px-2 py-1"
                >
                  Deseleziona tutte
                </button>
                <button 
                  onClick={() => downloadZip(selectedPhotos, `foto-selezionate-${currentStudent.surname}`)}
                  disabled={isZipping}
                  className="flex items-center gap-2 bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-lg"
                >
                  <Download size={15} />
                  <span>Scarica Selezionate 4K (.zip)</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-10">
            {currentStudent.events.map((event, eIdx) => {
              const filteredCourses = event.courses.filter(c => selectedCourseFilter === null || c.name === selectedCourseFilter);
              if (filteredCourses.length === 0) return null;

              const allEventPhotos = filteredCourses.flatMap((c) => c.photos);
              const isAllEventSelected = allEventPhotos.length > 0 && allEventPhotos.every((p) => selectedPhotos.includes(p));
              const isMinimized = minimizedEvents[eIdx];

              return (
                <div key={eIdx} className="border border-[#c9b074]/25 rounded-4xl p-6 sm:p-10 backdrop-blur-2xl bg-linear-to-b from-slate-900/50 to-slate-950/80 shadow-2xl transition-all">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleMinimizeEvent(eIdx)}
                        className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#c9b074] transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <ChevronDown size={20} className={`transition-transform duration-300 ${isMinimized ? "-rotate-90" : "rotate-0"}`} />
                      </button>
                      <div>
                        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#c9b074] block mb-0.5">Evento Accademico</span>
                        <h2 className="text-2xl sm:text-4xl font-normal font-playfair text-white">{event.eventName}</h2>
                        {event.description && <p className="text-xs sm:text-sm text-slate-300 mt-1 font-light">{event.description}</p>}
                      </div>
                    </div>

                    {allEventPhotos.length > 0 && !isMinimized && (
                      <button 
                        onClick={() => toggleSelectAllPhotos(allEventPhotos)}
                        className="flex items-center justify-center gap-2 text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-2xl transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        {isAllEventSelected ? <CheckSquare size={16} className="text-[#c9b074]" /> : <Square size={16} />}
                        <span>{isAllEventSelected ? "Deseleziona Evento" : "Seleziona Tutto l'Evento"}</span>
                      </button>
                    )}
                  </div>

                  {!isMinimized && (
                    <div className="space-y-8">
                      {filteredCourses.map((course, cIdx) => {
                        const isAllCourseSelected = course.photos.length > 0 && course.photos.every((p) => selectedPhotos.includes(p));

                        return (
                          <div key={cIdx} className="border border-white/10 rounded-3xl p-5 sm:p-7 bg-slate-950/40">
                            
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-white/5">
                              <h3 className="text-lg sm:text-2xl font-normal font-playfair flex items-center gap-3 text-white">
                                <span className="w-2 h-2 rounded-full bg-[#c9b074]" />
                                {currentStudent.is_minor 
                                  ? `Foto di ${currentStudent.name} ${currentStudent.surname} — ${course.name}`
                                  : `${course.name}`}
                              </h3>
                              {course.photos.length > 0 && (
                                <button 
                                  onClick={() => toggleSelectAllPhotos(course.photos)}
                                  className="flex items-center gap-2 text-xs text-slate-300 hover:text-[#c9b074] cursor-pointer font-medium transition-colors"
                                >
                                  {isAllCourseSelected ? <CheckSquare size={15} className="text-[#c9b074]" /> : <Square size={15} />}
                                  <span>{isAllCourseSelected ? "Deseleziona sezione" : "Seleziona sezione"}</span>
                                </button>
                              )}
                            </div>

                            {course.photos.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-5">
                                {course.photos.map((photoUrl, pIdx) => {
                                  const isSelected = selectedPhotos.includes(photoUrl);
                                  return (
                                    <div 
                                      key={pIdx} 
                                      className={`relative group rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 aspect-square bg-slate-900 shadow-md ${
                                        isSelected 
                                          ? "border-[#c9b074] ring-2 ring-[#c9b074]/60 scale-[1.02] shadow-xl" 
                                          : "border-white/10 hover:border-white/30 hover:scale-[1.01]"
                                      }`}
                                    >
                                      <img 
                                        src={photoUrl} 
                                        alt={`Foto ${currentStudent.name} ${currentStudent.surname}`} 
                                        onClick={() => openZoomWithList(photoUrl, course.photos)}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                                      />
                                      
                                      <div 
                                        onClick={() => openZoomWithList(photoUrl, course.photos)}
                                        className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3 pointer-events-none"
                                      >
                                        <span className="hidden sm:inline-flex items-center gap-1.5 bg-black/80 text-white text-[11px] font-medium px-3 py-1.5 rounded-xl border border-white/20 shadow-lg">
                                          <ZoomIn size={13} className="text-[#c9b074]" /> Ingrandisci 4K
                                        </span>
                                      </div>

                                      <div 
                                        onClick={(e) => { e.stopPropagation(); togglePhotoSelection(photoUrl); }}
                                        className="absolute top-2.5 left-2.5 z-10"
                                      >
                                        <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                                          isSelected 
                                            ? "bg-[#c9b074] text-black shadow-md scale-105" 
                                            : "bg-black/60 border border-white/30 text-transparent hover:bg-black/80"
                                        }`}>
                                          <Check size={14} className="stroke-3" />
                                        </div>
                                      </div>

                                      <button 
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadSinglePhoto(photoUrl, `foto-4k-${currentStudent.name}-${event.eventName}-${course.name}-${pIdx + 1}.jpg`);
                                        }}
                                        className="absolute top-2.5 right-2.5 bg-black/60 hover:bg-black/90 text-white p-2 rounded-xl backdrop-blur-md border border-white/10 shadow-md z-20 cursor-pointer transition-all active:scale-95"
                                        title="Scarica in HD"
                                      >
                                        <Download size={13} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs sm:text-sm italic text-slate-400 py-2">Nessuna foto disponibile in questa sezione.</p>
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
        /* LOGIN SCHERMATA INIZIALE */
        <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-10 lg:px-12 py-8 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20">
          <div className="w-full lg:w-7/12 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            <span className="text-xs font-semibold tracking-[0.4em] uppercase text-[#c9b074]">NUOVA ACCADEMIA TOSCANINI</span>
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-normal leading-[1.1] tracking-tight font-playfair text-white">
              Accedi alla tua <br />
              <span className="italic font-normal bg-linear-to-r from-white via-[#c9b074] to-slate-300 bg-clip-text text-transparent">Galleria Privata</span>
            </h1>
            <p className="text-sm sm:text-lg max-w-2xl font-normal leading-relaxed text-slate-200">
              Inserisci il tuo nome e cognome registrati dalla segreteria dell'accademia per esplorare, selezionare e scaricare i tuoi ricordi in altissima definizione.
            </p>
          </div>

          <div className="w-full lg:w-5/12 max-w-md">
            <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-10 backdrop-blur-2xl bg-linear-to-b from-slate-900/75 to-slate-950/95 shadow-2xl relative overflow-hidden">
              <form onSubmit={handleStudentLoginSubmit} className="space-y-4 sm:space-y-6">
                {loginError && (
                  <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-2xl text-xs font-medium">
                    {loginError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Nome Allievo</label>
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
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">Cognome Allievo</label>
                  <input 
                    type="text" 
                    value={loginSurname} 
                    onChange={(e) => setLoginSurname(e.target.value)} 
                    required 
                    placeholder="Rossi"
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#c9b074]" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-4 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loginLoading ? <Loader2 size={18} className="animate-spin" /> : <Unlock size={16} />}
                  <span>{loginLoading ? "Accesso..." : "Accedi alla galleria"}</span>
                </button>
              </form>
            </div>
          </div>
        </main>
      )}

      {/* Modal Inserimento Multiplo (Bulk) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="border border-[#c9b074]/30 rounded-4xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative backdrop-blur-2xl bg-slate-950/95 text-white shadow-2xl">
            <button onClick={() => setIsBulkModalOpen(false)} className="absolute top-5 right-5 p-2 rounded-full text-slate-300 hover:text-white bg-white/5 cursor-pointer">
              <X size={18} />
            </button>
            
            <div className="text-center mb-6">
              <span className="text-xs font-semibold tracking-[0.3em] uppercase text-[#c9b074] block mb-1">Staff Tools</span>
              <h2 className="text-3xl font-normal font-playfair text-white">Inserimento Multiplo Allievi</h2>
              <p className="text-xs text-slate-300 mt-1">Incolla un elenco di allievi.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-2 mb-6">
              <p className="font-bold text-[#c9b074]">Formato per ciascuna riga:</p>
              <code className="block bg-black/60 p-2 rounded text-amber-200">
                Nome, Cognome, Minorenne (si/no), Email Genitore, Sezioni (es. Pianoforte;Canto), Evento
              </code>
            </div>

            <form onSubmit={handleBulkInsert} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">
                  Elenco Allievi
                </label>
                <textarea
                  rows={8}
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder="Incolla le righe qui..."
                  required
                  className="w-full bg-black/60 border border-white/15 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:border-[#c9b074]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white bg-white/5 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Upload size={16} />
                  <span>Elabora e Importa Tutti</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Zoom Foto */}
      {zoomPhotoUrl && (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-between p-4 sm:p-8 animate-fadeIn"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div className="w-full max-w-6xl flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs sm:text-sm text-slate-300 font-mono">
              {zoomCurrentIndex + 1} / {activePhotosList.length} (Alta Definizione)
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleDownloadSinglePhoto(zoomPhotoUrl, "foto-saggio-4k.jpg")}
                className="flex items-center gap-1.5 bg-[#c9b074] text-black font-bold text-xs px-4 py-2 rounded-full shadow cursor-pointer"
              >
                <Download size={14} />
                <span>Scarica 4K</span>
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
              alt="Anteprima foto 4K" 
              className="max-w-full max-h-[70vh] object-contain rounded-2xl select-none shadow-2xl"
            />
          </div>

          <p className="text-slate-400 text-xs italic z-10">Tocca fuori o chiudi per tornare alla galleria</p>
        </div>
      )}

      {/* Modal FAQ */}
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
                <h3 className="font-bold text-white mb-1 font-playfair">1. Accesso</h3>
                <p>Inserisci nome e cognome registrati dalla segreteria dell'accademia.</p>
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

      {/* Modal Admin Password */}
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
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2 text-slate-200">PASSWORD STAFF</label>
                <div className="relative">
                  <input 
                    type="password"
                    value={adminPasswordInput}
                    onInput={(e) => setAdminPasswordInput((e.target as HTMLInputElement).value)}
                    placeholder="••••••••"
                    autoFocus
                    className="w-full bg-black/50 border border-white/15 rounded-2xl p-3.5 text-sm text-white focus:outline-none focus:border-[#c9b074]"
                  />
                </div>
                {adminPasswordError && (
                  <p className="text-red-400 text-xs mt-1.5 font-medium">Password non corretta. Riprova.</p>
                )}
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#c9b074] hover:bg-[#b89f63] text-black font-bold text-sm py-3.5 rounded-full transition-all active:scale-95 cursor-pointer shadow-lg mt-2 flex items-center justify-center gap-2"
              >
                <Unlock size={16} />
                <span>Accedi come Staff</span>
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="relative z-10 w-full py-6 text-center border-t border-white/5 text-xs text-slate-500 font-light mt-auto">
        © {new Date().getFullYear()} Nuova Accademia Toscanini. Tutti i diritti riservati.
      </footer>
    </div>
  );
}