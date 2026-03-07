/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  Search, 
  MapPin, 
  Church, 
  Users, 
  Phone, 
  Briefcase, 
  Home, 
  Truck, 
  ChevronRight,
  Loader2,
  AlertCircle,
  Filter,
  User,
  Database,
  Headset
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types for our data
interface CoordinatorData {
  MUNICIPIO: string;
  IGLESIA: string;
  COMUNA: string;
  'NOMBRE COMPLETO': string;
  TELEFONO: string;
  'FUNCIÓN': string;
  'CASA DE APOYO': string;
  'PUNTO DE RECOGIDA TRANSPORTE': string;
  'PUNTO DE DESCARGA TRANSPORTE': string;
}

export default function App() {
  const [data, setData] = useState<CoordinatorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedMunicipio, setSelectedMunicipio] = useState<string>('');
  const [selectedIglesia, setSelectedIglesia] = useState<string>('');
  const [selectedComuna, setSelectedComuna] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'TODOS' | 'PUESTO' | 'TRANSPORTE' | 'BASE_DATOS' | 'CALL_CENTER'>('TODOS');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Using gviz/tq endpoint which is often more reliable for public sheets
        const GVIZ_URL = `https://docs.google.com/spreadsheets/d/1U7qvBacumW9aUmbhkRa6VaYskD04eEn_/gviz/tq?tqx=out:csv`;
        const response = await fetch(GVIZ_URL);
        
        if (!response.ok) {
          // Fallback to standard export if gviz fails
          const FALLBACK_URL = `https://docs.google.com/spreadsheets/d/1U7qvBacumW9aUmbhkRa6VaYskD04eEn_/export?format=csv`;
          const fallbackResponse = await fetch(FALLBACK_URL);
          if (!fallbackResponse.ok) throw new Error('No se pudo acceder al Google Sheet. Verifique que el archivo tenga permisos de "Cualquier persona con el enlace puede ver".');
          processCSV(await fallbackResponse.text());
        } else {
          processCSV(await response.text());
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    const processCSV = (csvText: string) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(), // Trim spaces from headers
        complete: (results) => {
          if (results.data.length === 0) {
            setError('El archivo está vacío o no se pudo procesar correctamente.');
          } else {
            // Normalize data keys to match our interface exactly
            const normalizedData = (results.data as any[]).map(row => {
              const newRow: any = {};
              Object.keys(row).forEach(key => {
                const normalizedKey = key.trim().toUpperCase();
                const value = row[key]?.toString().trim() || '';
                
                // Map variations to our standard keys
                if (normalizedKey.includes('MUNICIPIO')) newRow.MUNICIPIO = value;
                else if (normalizedKey.includes('IGLESIA')) newRow.IGLESIA = value;
                else if (normalizedKey.includes('COMUNA')) newRow.COMUNA = value;
                else if (normalizedKey.includes('NOMBRE COMPLETO')) newRow['NOMBRE COMPLETO'] = value;
                else if (normalizedKey.includes('TELEFONO')) newRow.TELEFONO = value;
                else if (normalizedKey.includes('FUNCIÓN') || normalizedKey.includes('FUNCION')) newRow['FUNCIÓN'] = value;
                else if (normalizedKey.includes('CASA DE APOYO')) newRow['CASA DE APOYO'] = value;
                else if (normalizedKey.includes('RECOGIDA')) newRow['PUNTO DE RECOGIDA TRANSPORTE'] = value;
                else if (normalizedKey.includes('DESCARGA')) newRow['PUNTO DE DESCARGA TRANSPORTE'] = value;
                else newRow[key] = value;
              });
              return newRow as CoordinatorData;
            });
            setData(normalizedData);
          }
          setLoading(false);
        },
        error: (err: any) => {
          setError('Error al procesar el CSV: ' + err.message);
          setLoading(false);
        }
      });
    };

    fetchData();
  }, []);

  // Derived options for filters
  const municipios = useMemo(() => {
    return Array.from(new Set(data.map(item => item.MUNICIPIO))).filter(Boolean).sort();
  }, [data]);

  const iglesias = useMemo(() => {
    if (!selectedMunicipio) return [];
    return Array.from(new Set(
      data
        .filter(item => item.MUNICIPIO === selectedMunicipio)
        .map(item => item.IGLESIA)
    )).filter(Boolean).sort();
  }, [data, selectedMunicipio]);

  const comunas = useMemo(() => {
    if (!selectedIglesia) return [];
    return Array.from(new Set(
      data
        .filter(item => item.MUNICIPIO === selectedMunicipio && item.IGLESIA === selectedIglesia)
        .map(item => item.COMUNA)
    )).filter(Boolean).sort();
  }, [data, selectedMunicipio, selectedIglesia]);

  const filteredResults = useMemo(() => {
    let results = data;

    // Apply hierarchical filters
    if (selectedMunicipio) {
      results = results.filter(item => item.MUNICIPIO === selectedMunicipio);
    }

    // Special logic: If Comuna is selected, it shows all in that Comuna within the Municipio
    if (selectedComuna) {
      results = results.filter(item => item.COMUNA === selectedComuna);
    } else if (selectedIglesia) {
      results = results.filter(item => item.IGLESIA === selectedIglesia);
    }

    // Apply intelligent search if query exists
    if (searchQuery.trim()) {
      // Normalize function to remove accents and lowercase
      const normalize = (text: string) => 
        text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const queryWords = normalize(searchQuery).trim().split(/\s+/).filter(word => word.length > 0);
      
      results = results.filter(item => {
        const searchableFields = [
          item['NOMBRE COMPLETO'],
          item.MUNICIPIO,
          item.IGLESIA,
          item.COMUNA,
          item['FUNCIÓN'],
          item['CASA DE APOYO'],
          item['PUNTO DE RECOGIDA TRANSPORTE'],
          item['PUNTO DE DESCARGA TRANSPORTE'],
          item.TELEFONO
        ].map(v => normalize(v || ''));

        const searchableText = searchableFields.join(' ');
        
        // Count how many query words are present in the item's fields
        const matchCount = queryWords.filter(word => searchableText.includes(word)).length;
        
        // Flexible matching logic:
        // 1 word -> must match 1
        // 2 words -> must match at least 1
        // 3+ words -> must match at least 2
        if (queryWords.length === 1) {
          return matchCount >= 1;
        } else if (queryWords.length === 2) {
          return matchCount >= 1;
        } else {
          return matchCount >= 2;
        }
      });
    }

    // If no search and no comuna selected, return empty to prompt user
    if (!searchQuery.trim() && !selectedComuna) return [];

    return results;
  }, [data, selectedMunicipio, selectedIglesia, selectedComuna, searchQuery]);

  const clearFilters = () => {
    setSelectedMunicipio('');
    setSelectedIglesia('');
    setSelectedComuna('');
    setSearchQuery('');
    setActiveTab('TODOS');
  };

  const tabResults = useMemo(() => {
    if (activeTab === 'TODOS') {
      return filteredResults;
    }
    if (activeTab === 'PUESTO') {
      return filteredResults.filter(item => 
        item['FUNCIÓN']?.toUpperCase().includes('PUESTO')
      );
    } else if (activeTab === 'TRANSPORTE') {
      const transport = filteredResults.filter(item => 
        item['FUNCIÓN']?.toUpperCase().includes('TRANSPORTE')
      );
      // Sort: COORDINADOR DE TRANSPORTE GENERAL first
      return [...transport].sort((a, b) => {
        const funcA = a['FUNCIÓN']?.toUpperCase() || '';
        const funcB = b['FUNCIÓN']?.toUpperCase() || '';
        const isGeneralA = funcA.includes('GENERAL');
        const isGeneralB = funcB.includes('GENERAL');
        if (isGeneralA && !isGeneralB) return -1;
        if (!isGeneralA && isGeneralB) return 1;
        return 0;
      });
    } else if (activeTab === 'BASE_DATOS') {
      return filteredResults.filter(item => 
        item['FUNCIÓN']?.toUpperCase().includes('BASE DE DATOS') || 
        item['FUNCIÓN']?.toUpperCase().includes('DATOS')
      );
    } else if (activeTab === 'CALL_CENTER') {
      return filteredResults.filter(item => 
        item['FUNCIÓN']?.toUpperCase().includes('CALL CENTER')
      );
    }
    return [];
  }, [filteredResults, activeTab]);

  // Reset dependent filters
  useEffect(() => {
    setSelectedIglesia('');
    setSelectedComuna('');
  }, [selectedMunicipio]);

  useEffect(() => {
    setSelectedComuna('');
  }, [selectedIglesia]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-600 font-medium animate-pulse">Cargando directorio de coordinadores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 flex flex-col items-center max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Error de Conexión</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header - Matching the image style */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <MapPin className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                <span className="hidden sm:inline">Panel Central de Coordinadores Risaralda</span>
                <span className="sm:hidden">Panel Central de Coordinadores</span>
              </h1>
              <p className="text-sm text-slate-500 font-medium hidden sm:block">
                Risaralda · Dashboard Directorios de coordinadores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">administrador</p>
            </div>
            <div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
              AD
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar Section */}
        <section className="mb-8">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim()) {
                  setSelectedMunicipio('');
                  setSelectedIglesia('');
                  setSelectedComuna('');
                }
              }}
              placeholder="Buscador inteligente: Escriba nombre, función, municipio, iglesia, comuna o casa de apoyo..."
              className="block w-full pl-14 pr-4 py-5 bg-white border border-slate-200 rounded-3xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all text-lg"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <AlertCircle className="h-5 w-5" />
              </button>
            )}
          </div>
        </section>

        {/* Filter Section */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">Filtros de Búsqueda</h2>
              </div>
              {(selectedMunicipio || selectedIglesia || selectedComuna) && (
                <button 
                  onClick={clearFilters}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Municipio Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> Municipio
                </label>
                <select 
                  value={selectedMunicipio}
                  onChange={(e) => {
                    setSelectedMunicipio(e.target.value);
                    if (e.target.value) setSearchQuery('');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">Seleccione Municipio</option>
                  {municipios.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Iglesia Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Church className="w-3 h-3" /> Iglesia
                </label>
                <select 
                  value={selectedIglesia}
                  onChange={(e) => {
                    setSelectedIglesia(e.target.value);
                    if (e.target.value) setSearchQuery('');
                  }}
                  disabled={!selectedMunicipio}
                  className={cn(
                    "w-full border rounded-xl px-4 py-3 text-slate-700 outline-none transition-all appearance-none cursor-pointer",
                    !selectedMunicipio ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-50" : "bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  )}
                >
                  <option value="">Seleccione Iglesia</option>
                  {iglesias.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>

              {/* Comuna Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-3 h-3" /> Comuna
                </label>
                <select 
                  value={selectedComuna}
                  onChange={(e) => {
                    setSelectedComuna(e.target.value);
                    if (e.target.value) setSearchQuery('');
                  }}
                  disabled={!selectedIglesia}
                  className={cn(
                    "w-full border rounded-xl px-4 py-3 text-slate-700 outline-none transition-all appearance-none cursor-pointer",
                    !selectedIglesia ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-50" : "bg-slate-50 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  )}
                >
                  <option value="">Seleccione Comuna</option>
                  {comunas.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Section */}
        {(selectedMunicipio || selectedIglesia || selectedComuna || searchQuery.trim()) && (
          <div className="w-full p-1 bg-slate-200/50 rounded-2xl mb-8 flex flex-wrap sm:flex-nowrap gap-1">
            <button
              onClick={() => setActiveTab('TODOS')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]",
                activeTab === 'TODOS' 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users className="w-4 h-4" />
              TODOS
            </button>
            <button
              onClick={() => setActiveTab('PUESTO')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]",
                activeTab === 'PUESTO' 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users className="w-4 h-4" />
              PUESTO
            </button>
            <button
              onClick={() => setActiveTab('TRANSPORTE')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]",
                activeTab === 'TRANSPORTE' 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Truck className="w-4 h-4" />
              TRANSPORTE
            </button>
            <button
              onClick={() => setActiveTab('BASE_DATOS')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]",
                activeTab === 'BASE_DATOS' 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Database className="w-4 h-4" />
              BASE DE DATOS
            </button>
            <button
              onClick={() => setActiveTab('CALL_CENTER')}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-w-[120px]",
                activeTab === 'CALL_CENTER' 
                  ? "bg-white text-blue-600 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Headset className="w-4 h-4" />
              CALL CENTER
            </button>
          </div>
        )}

        {/* Results Section */}
        <section>
          <AnimatePresence mode="wait">
            {!selectedComuna && !searchQuery.trim() ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Inicie una búsqueda</h3>
                <p className="text-slate-500 max-w-xs text-center">
                  Utilice el buscador inteligente o seleccione un municipio, iglesia y comuna para visualizar la información.
                </p>
              </motion.div>
            ) : tabResults.length === 0 ? (
              <motion.div 
                key="no-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200"
              >
                <Users className="w-12 h-12 text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-800">No se encontraron coordinadores</h3>
                <p className="text-slate-500">No hay registros para esta categoría en la selección actual.</p>
              </motion.div>
            ) : (
              <motion.div 
                key={`${selectedComuna}-${activeTab}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                {tabResults.map((item, index) => (
                  <motion.div 
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-blue-500/5 transition-all group"
                  >
                    {/* Card Header */}
                    <div className={cn(
                      "p-6 text-white relative overflow-hidden transition-colors",
                      activeTab === 'TODOS' ? "bg-slate-800" :
                      activeTab === 'PUESTO' ? "bg-blue-600" : 
                      activeTab === 'TRANSPORTE' ? "bg-indigo-600" :
                      activeTab === 'BASE_DATOS' ? "bg-emerald-600" : "bg-violet-600"
                    )}>
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        {activeTab === 'TODOS' ? <Users className="w-24 h-24" /> :
                         activeTab === 'PUESTO' ? <User className="w-24 h-24" /> : 
                         activeTab === 'TRANSPORTE' ? <Truck className="w-24 h-24" /> :
                         activeTab === 'BASE_DATOS' ? <Database className="w-24 h-24" /> : <Headset className="w-24 h-24" />}
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                            {item['FUNCIÓN'] || 'Coordinador'}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold leading-tight">{item['NOMBRE COMPLETO']}</h3>
                        <div className="flex items-center gap-2 mt-2 text-white/80 text-sm">
                          <Church className="w-4 h-4" />
                          <span>{item.IGLESIA}</span>
                          <span className="opacity-50">|</span>
                          <Users className="w-4 h-4" />
                          <span>Comuna {item.COMUNA}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-8 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Phone */}
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Phone className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Teléfono</p>
                            <p className="text-slate-700 font-bold text-lg">{item.TELEFONO || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Function */}
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Briefcase className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Función</p>
                            <p className="text-slate-700 font-bold">{item['FUNCIÓN'] || 'N/A'}</p>
                          </div>
                        </div>

                        {/* Support House */}
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Home className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Casa de Apoyo</p>
                            <p className="text-slate-700 font-bold">{item['CASA DE APOYO'] || 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Logística de Transporte</h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center flex-shrink-0">
                              <Truck className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punto de Recogida</p>
                              <p className="text-slate-700 text-sm font-medium">{item['PUNTO DE RECOGIDA TRANSPORTE'] || 'No especificado'}</p>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center flex-shrink-0 rotate-180">
                              <Truck className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punto de Descarga</p>
                              <p className="text-slate-700 text-sm font-medium">{item['PUNTO DE DESCARGA TRANSPORTE'] || 'No especificado'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm font-medium">
            © {new Date().getFullYear()} Panel Central de Coordinadores Risaralda
          </p>
        </div>
      </footer>
    </div>
  );
}
