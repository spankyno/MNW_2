import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Cloud, 
  Save, 
  Trash2, 
  Heart, 
  Search, 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon, 
  FileText, 
  ArrowLeft, 
  Undo2,
  CloudOff,
  LogOut,
  Download,
  Info,
  Moon,
  Sun,
  ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { isSameDay, parseISO } from 'date-fns';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Note, AppSettings } from './types';
import { cn, formatDate } from './lib/utils';

// --- Mock Data for Preview ---
const MOCK_NOTES: Note[] = [
  {
    id: '1',
    title: 'Ideas para el proyecto',
    content: 'Esta es una nota local guardada en el dispositivo. Contiene ideas sobre la arquitectura de la app.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_local: true,
    is_favorite: true,
  },
  {
    id: '2',
    title: 'Lista de la compra',
    content: 'Leche, huevos, pan, fruta, verduras.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    is_local: false,
    is_favorite: false,
  }
];

const NoteCard = ({ 
  note, 
  onOpen, 
  onFavorite, 
  onDelete 
}: { 
  note: Note; 
  onOpen: (note: Note) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string, isLocal: boolean) => void;
  key?: string;
}) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    onClick={() => onOpen(note)}
  >
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        {note.is_local ? (
          <Save className="w-4 h-4 text-emerald-500" />
        ) : (
          <Cloud className="w-4 h-4 text-blue-500" />
        )}
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]">
          {note.title}
        </h3>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onFavorite(note.id); }}
          className={cn("p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors", 
            note.is_favorite ? "text-red-500" : "text-zinc-400")}
        >
          <Heart className={cn("w-4 h-4", note.is_favorite && "fill-current")} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(note.id, note.is_local); }}
          className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3 h-10">
      {note.content || <span className="italic opacity-50">Sin contenido</span>}
    </p>
    <div className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
      {formatDate(note.updated_at)}
    </div>
  </motion.div>
);

export default function App() {
  const [view, setView] = useState<'main' | 'calendar' | 'search' | 'favorites' | 'settings' | 'editor'>('main');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
    lineNumbers: true,
  });
  const [history, setHistory] = useState<string[]>([]);
  
  // Modal states
  const [modal, setModal] = useState<{
    type: 'create' | 'confirm' | 'login' | 'signup' | null;
    title?: string;
    message?: string;
    onConfirm?: (value?: string) => void;
    inputValue?: string;
    emailValue?: string;
    passwordValue?: string;
  }>({ type: null });

  // Initialize data
  useEffect(() => {
    const savedNotes = localStorage.getItem('mnw_local_notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    } else {
      setNotes(MOCK_NOTES);
    }

    const savedSettings = localStorage.getItem('mnw_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Persist local notes
  useEffect(() => {
    localStorage.setItem('mnw_local_notes', JSON.stringify(notes));
  }, [notes]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('mnw_settings', JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // --- Actions ---
  const handleCreateLocalNote = () => {
    console.log('Creating local note...');
    setModal({
      type: 'create',
      title: 'Nueva Nota Local',
      message: 'Introduce el nombre para tu nueva nota:',
      inputValue: '',
      onConfirm: (name) => {
        console.log('Confirming local note creation:', name);
        const finalName = name?.trim() || `Nota ${new Date().toLocaleDateString()}`;
        const newNote: Note = {
          id: Math.random().toString(36).substr(2, 9),
          title: finalName,
          content: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_local: true,
          is_favorite: false,
        };
        setNotes(currentNotes => [newNote, ...currentNotes]);
        handleOpenEditor(newNote);
        setModal({ type: null });
      }
    });
  };

  const handleLoadLocalFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      setModal({
        type: 'confirm',
        title: 'Error',
        message: 'Por favor, selecciona un archivo .txt',
        onConfirm: () => setModal({ type: null })
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const newNote: Note = {
        id: Math.random().toString(36).substr(2, 9),
        title: file.name.replace('.txt', ''),
        content: content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_local: true,
        is_favorite: false,
      };
      setNotes(currentNotes => [newNote, ...currentNotes]);
      handleOpenEditor(newNote);
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleCreateWebNote = async () => {
    console.log('Creating web note...');
    if (!isSupabaseConfigured) {
      console.warn('Supabase not configured');
      setModal({
        type: 'confirm',
        title: 'Configuración requerida',
        message: 'Supabase no está configurado. Por favor, añade las claves en los ajustes.',
        onConfirm: () => {
          setView('settings');
          setModal({ type: null });
        }
      });
      return;
    }

    if (!user) {
      console.warn('User not logged in');
      setModal({
        type: 'confirm',
        title: 'Sesión requerida',
        message: 'Inicia sesión para crear notas en la nube.',
        onConfirm: () => {
          setView('settings');
          setModal({ type: null });
        }
      });
      return;
    }
    
    const title = 'Nueva nota web';
    const { data, error } = await supabase
      .from('notes')
      .insert([{ title, content: '', user_id: user.id }])
      .select()
      .single();

    if (error) {
      setModal({
        type: 'confirm',
        title: 'Error',
        message: 'Error al crear nota web: ' + error.message,
        onConfirm: () => setModal({ type: null })
      });
      return;
    }

    const newNote: Note = {
      ...data,
      is_local: false,
      is_favorite: false,
    };
    setNotes(currentNotes => [newNote, ...currentNotes]);
    handleOpenEditor(newNote);
  };

  const handleOpenEditor = useCallback((note: Note) => {
    setSelectedNote(note);
    setHistory([note.content]);
    setView('editor');
  }, []);

  const handleSaveNote = useCallback((content: string) => {
    setSelectedNote(prev => {
      if (!prev) return null;
      const updatedNote = {
        ...prev,
        content,
        updated_at: new Date().toISOString()
      };
      
      setNotes(currentNotes => currentNotes.map(n => n.id === updatedNote.id ? updatedNote : n));
      
      if (!updatedNote.is_local && user && isSupabaseConfigured) {
        supabase.from('notes').update({ 
          content: updatedNote.content, 
          updated_at: updatedNote.updated_at 
        }).eq('id', updatedNote.id).then();
      }
      
      return updatedNote;
    });
  }, [user]);

  const handleDeleteNote = useCallback((id: string, isLocal: boolean) => {
    console.log('Deleting note:', id, 'isLocal:', isLocal);
    setModal({
      type: 'confirm',
      title: 'Eliminar Nota',
      message: '¿Estás seguro de que quieres eliminar esta nota? Esta acción no se puede deshacer.',
      onConfirm: () => {
        console.log('Confirming deletion for:', id);
        if (isLocal) {
          setNotes(currentNotes => currentNotes.filter(n => n.id !== id));
        } else {
          if (isSupabaseConfigured) {
            supabase.from('notes').delete().eq('id', id).then(() => {
              setNotes(currentNotes => currentNotes.filter(n => n.id !== id));
            });
          } else {
            setNotes(currentNotes => currentNotes.filter(n => n.id !== id));
          }
        }
        setView('main');
        setSelectedNote(null);
        setModal({ type: null });
      }
    });
  }, [isSupabaseConfigured]);

  const toggleFavorite = useCallback((id: string) => {
    setNotes(currentNotes => currentNotes.map(n => n.id === id ? { ...n, is_favorite: !n.is_favorite } : n));
    setSelectedNote(prev => {
      if (prev?.id === id) {
        return { ...prev, is_favorite: !prev.is_favorite };
      }
      return prev;
    });
  }, []);

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const previousContent = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      handleSaveNote(previousContent);
    }
  };

  const handleBackup = async () => {
    const zip = new JSZip();
    notes.forEach(note => {
      zip.file(`${note.title}.txt`, note.content);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MNW_Backup_${format(new Date(), 'yyyyMMdd')}.zip`;
    link.click();
  };

  // --- Filtering ---
  const filteredNotes = useMemo(() => {
    if (view === 'favorites') return notes.filter(n => n.is_favorite);
    if (view === 'search') {
      return notes.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return notes;
  }, [notes, view, searchQuery]);

  // --- Components ---
  const Navigation = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 flex justify-between items-center z-50">
      <button onClick={() => setView('main')} className={cn("p-2 rounded-xl transition-colors", view === 'main' ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400")}>
        <FileText className="w-6 h-6" />
      </button>
      <button onClick={() => setView('calendar')} className={cn("p-2 rounded-xl transition-colors", view === 'calendar' ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400")}>
        <CalendarIcon className="w-6 h-6" />
      </button>
      <button onClick={() => setView('search')} className={cn("p-2 rounded-xl transition-colors", view === 'search' ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400")}>
        <Search className="w-6 h-6" />
      </button>
      <button onClick={() => setView('favorites')} className={cn("p-2 rounded-xl transition-colors", view === 'favorites' ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400")}>
        <Heart className="w-6 h-6" />
      </button>
      <button onClick={() => setView('settings')} className={cn("p-2 rounded-xl transition-colors", view === 'settings' ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400")}>
        <SettingsIcon className="w-6 h-6" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-200 dark:selection:bg-emerald-500/30">
      
      {/* --- Main View --- */}
      {view === 'main' && (
        <div className="p-6 pb-24 max-w-2xl mx-auto">
          <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FileText className="text-white w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">MNW</h1>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Mis Notas Web</p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <button 
              onClick={handleCreateLocalNote}
              className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-emerald-500 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tight">Nueva Local</span>
            </button>
            <label className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-amber-500 transition-all group cursor-pointer">
              <input 
                type="file" 
                accept=".txt" 
                className="hidden" 
                onChange={handleLoadLocalFile}
              />
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Download className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tight">Cargar Local</span>
            </label>
            <button 
              onClick={handleCreateWebNote}
              className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-blue-500 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Cloud className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tight">Nueva Web</span>
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Biblioteca</h2>
            <span className="text-xs text-zinc-400 font-mono">
              {notes.filter(n => !n.is_local).length} Web · {notes.filter(n => n.is_local).length} Locales
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {notes.map(note => (
              <NoteCard 
                key={note.id} 
                note={note} 
                onOpen={handleOpenEditor}
                onFavorite={toggleFavorite}
                onDelete={handleDeleteNote}
              />
            ))}
          </div>
        </div>
      )}

      {/* --- Calendar View --- */}
      {view === 'calendar' && (
        <div className="p-6 pb-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Calendario</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
            <div className="grid grid-cols-7 gap-2 text-center mb-4">
              {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map(d => (
                <span key={d} className="text-[10px] font-bold text-zinc-400">{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 31 }).map((_, i) => {
                const day = i + 1;
                const date = new Date(2026, 2, day);
                const hasNotes = notes.some(n => isSameDay(parseISO(n.updated_at), date));
                return (
                  <button 
                    key={i} 
                    className={cn(
                      "aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all",
                      hasNotes ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-center text-sm text-zinc-500 italic">Toca un día para ver las notas modificadas</p>
        </div>
      )}

      {/* --- Search View --- */}
      {view === 'search' && (
        <div className="p-6 pb-24 max-w-2xl mx-auto">
          <div className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar en el contenido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {filteredNotes.map(note => (
              <NoteCard 
                key={note.id} 
                note={note} 
                onOpen={handleOpenEditor}
                onFavorite={toggleFavorite}
                onDelete={handleDeleteNote}
              />
            ))}
            {filteredNotes.length === 0 && (
              <div className="text-center py-20 text-zinc-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No se encontraron notas</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Favorites View --- */}
      {view === 'favorites' && (
        <div className="p-6 pb-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Heart className="text-red-500 fill-current" /> Favoritos
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {filteredNotes.map(note => (
              <NoteCard 
                key={note.id} 
                note={note} 
                onOpen={handleOpenEditor}
                onFavorite={toggleFavorite}
                onDelete={handleDeleteNote}
              />
            ))}
            {filteredNotes.length === 0 && (
              <div className="text-center py-20 text-zinc-400">
                <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Aún no tienes favoritos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Settings View --- */}
      {view === 'settings' && (
        <div className="p-6 pb-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Ajustes</h2>
          
          <section className="mb-8">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Preferencias</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    {settings.darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </div>
                  <span className="font-medium">Modo Oscuro</span>
                </div>
                <button 
                  onClick={() => setSettings({ ...settings, darkMode: !settings.darkMode })}
                  className={cn("w-12 h-6 rounded-full transition-colors relative", settings.darkMode ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700")}
                >
                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", settings.darkMode ? "left-7" : "left-1")} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <ListOrdered className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Números de línea</span>
                </div>
                <button 
                  onClick={() => setSettings({ ...settings, lineNumbers: !settings.lineNumbers })}
                  className={cn("w-12 h-6 rounded-full transition-colors relative", settings.lineNumbers ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-700")}
                >
                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", settings.lineNumbers ? "left-7" : "left-1")} />
                </button>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Cuenta y Sincronización</h3>
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6">
              {!isSupabaseConfigured ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CloudOff className="w-7 h-7 text-red-500" />
                  </div>
                  <h4 className="font-bold mb-2">Supabase no configurado</h4>
                  <p className="text-xs text-zinc-500 mb-4">
                    Por favor, añade <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> como secretos en AI Studio.
                  </p>
                  <button 
                    onClick={() => window.open('https://supabase.com', '_blank')}
                    className="text-xs text-blue-500 font-bold hover:underline"
                  >
                    Obtener claves de Supabase
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center">
                      <Cloud className="w-7 h-7 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-bold">Supabase</h4>
                      <p className="text-xs text-zinc-500">
                        {user ? `Sesión activa: ${user.email}` : 'Inicia sesión para sincronizar notas'}
                      </p>
                    </div>
                  </div>
                  {user ? (
                    <button 
                      onClick={() => supabase.auth.signOut()}
                      className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                    >
                      <LogOut className="w-5 h-5" /> Cerrar Sesión
                    </button>
                  ) : (
                    <button 
                      onClick={() => setModal({ type: 'login', title: 'Iniciar Sesión' })}
                      className="w-full py-3 bg-blue-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                    >
                      <Cloud className="w-5 h-5" /> Iniciar Sesión
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Backup</h3>
            <button 
              onClick={handleBackup}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 flex items-center justify-between hover:border-emerald-500 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                  <Download className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="font-medium">Exportar todas las notas (.zip)</span>
              </div>
              <Plus className="w-5 h-5 text-zinc-300 rotate-45" />
            </button>
          </section>

          <section>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Información</h3>
            <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-3xl p-6 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <div className="flex items-center gap-2 mb-2 text-zinc-900 dark:text-zinc-100 font-bold">
                <Info className="w-4 h-4" /> MNW (Mis Notas Web)
              </div>
              <p className="mb-4">App de notas de texto plano. Sincronizado con Supabase al iniciar sesión.</p>
              <p className="text-[10px] uppercase tracking-tighter">Aitor Sánchez Gutiérrez (c) 2026. Todos los derechos reservados.</p>
            </div>
          </section>
        </div>
      )}

      {/* --- Editor View --- */}
      <AnimatePresence>
        {view === 'editor' && selectedNote && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white dark:bg-black z-[100] flex flex-col"
          >
            <header className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setView('main')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <input 
                  type="text" 
                  value={selectedNote.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    setSelectedNote({ ...selectedNote, title: newTitle });
                    setNotes(notes.map(n => n.id === selectedNote.id ? { ...n, title: newTitle } : n));
                  }}
                  className="bg-transparent font-bold text-lg focus:outline-none truncate max-w-[180px]"
                />
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleUndo} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400">
                  <Undo2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => toggleFavorite(selectedNote.id)}
                  className={cn("p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors", selectedNote.is_favorite ? "text-red-500" : "text-zinc-400")}
                >
                  <Heart className={cn("w-5 h-5", selectedNote.is_favorite && "fill-current")} />
                </button>
                {selectedNote.is_local && (
                  <button className="p-2 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 ml-1">
                    <Save className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => handleDeleteNote(selectedNote.id, selectedNote.is_local)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-xl transition-colors ml-1"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto inertial-scroll relative">
              <div className="flex min-h-full">
                {settings.lineNumbers && (
                  <div className="w-10 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-100 dark:border-zinc-900 py-6 text-[10px] font-mono text-zinc-300 dark:text-zinc-700 text-right pr-2 select-none">
                    {Array.from({ length: Math.max(20, selectedNote.content.split('\n').length + 5) }).map((_, i) => (
                      <div key={i} className="h-6 leading-6">{i + 1}</div>
                    ))}
                  </div>
                )}
                <textarea 
                  autoFocus
                  value={selectedNote.content}
                  onChange={(e) => {
                    const newContent = e.target.value;
                    handleSaveNote(newContent);
                    if (newContent !== history[history.length - 1]) {
                      setHistory([...history, newContent]);
                    }
                  }}
                  placeholder="Empieza a escribir..."
                  className="flex-1 p-6 bg-transparent resize-none focus:outline-none font-mono text-sm leading-6 dark:text-zinc-300"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {view !== 'editor' && <Navigation />}

      {/* --- Custom Modal --- */}
      <AnimatePresence>
        {modal.type && (
          <motion.div 
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
            onClick={() => setModal({ type: null })}
          >
            <motion.div 
              key="modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-zinc-200 dark:border-zinc-800"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-2">{modal.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{modal.message}</p>
              
              {modal.type === 'create' && (
                <input 
                  autoFocus
                  type="text" 
                  value={modal.inputValue}
                  onChange={(e) => setModal({ ...modal, inputValue: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && modal.onConfirm?.(modal.inputValue)}
                  placeholder="Nombre de la nota..."
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl py-3 px-4 mb-6 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              )}

              {(modal.type === 'login' || modal.type === 'signup') && (
                <div className="space-y-4 mb-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Email</label>
                    <input 
                      type="email" 
                      value={modal.emailValue || ''}
                      onChange={(e) => setModal({ ...modal, emailValue: e.target.value })}
                      placeholder="tu@email.com"
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-zinc-400 px-1">Contraseña</label>
                    <input 
                      type="password" 
                      value={modal.passwordValue || ''}
                      onChange={(e) => setModal({ ...modal, passwordValue: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  
                  {modal.type === 'login' ? (
                    <>
                      <button 
                        onClick={async () => {
                          try {
                            console.log('Attempting login...');
                            const { error } = await supabase.auth.signInWithPassword({
                              email: modal.emailValue || '',
                              password: modal.passwordValue || ''
                            });
                            if (error) {
                              setModal(prev => ({ ...prev, message: 'Error: ' + error.message }));
                            } else {
                              setModal({ type: null });
                            }
                          } catch (err: any) {
                            setModal(prev => ({ ...prev, message: 'Error: ' + err.message }));
                          }
                        }}
                        className="w-full py-3 bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20"
                      >
                        Iniciar Sesión
                      </button>
                      <button 
                        onClick={() => setModal({ ...modal, type: 'signup', title: 'Crear Cuenta', message: 'Regístrate para sincronizar tus notas.' })}
                        className="w-full py-2 text-sm text-blue-500 font-medium hover:underline"
                      >
                        ¿No tienes cuenta? Regístrate
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={async () => {
                          try {
                            console.log('Attempting signup...');
                            const { error } = await supabase.auth.signUp({
                              email: modal.emailValue || '',
                              password: modal.passwordValue || ''
                            });
                            if (error) {
                              setModal(prev => ({ ...prev, message: 'Error: ' + error.message }));
                            } else {
                              setModal({ 
                                type: 'confirm', 
                                title: 'Registro exitoso', 
                                message: 'Revisa tu email para confirmar la cuenta (si está habilitado) o intenta iniciar sesión.',
                                onConfirm: () => setModal({ type: null })
                              });
                            }
                          } catch (err: any) {
                            setModal(prev => ({ ...prev, message: 'Error: ' + err.message }));
                          }
                        }}
                        className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20"
                      >
                        Crear Cuenta
                      </button>
                      <button 
                        onClick={() => setModal({ ...modal, type: 'login', title: 'Iniciar Sesión', message: 'Ingresa tus credenciales para continuar.' })}
                        className="w-full py-2 text-sm text-emerald-500 font-medium hover:underline"
                      >
                        ¿Ya tienes cuenta? Inicia sesión
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button 
                  onClick={() => setModal({ type: null })}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold text-zinc-500"
                >
                  Cancelar
                </button>
                {modal.type !== 'login' && modal.type !== 'signup' && (
                  <button 
                    onClick={() => modal.onConfirm?.(modal.inputValue)}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style>{`
        .inertial-scroll {
          -webkit-overflow-scrolling: touch;
        }
        textarea {
          caret-color: #10b981;
        }
      `}</style>
    </div>
  );
}
