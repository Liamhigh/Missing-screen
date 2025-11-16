
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload.tsx';
import { AnalysisDisplay } from './components/AnalysisDisplay.tsx';
import { Loader } from './components/Loader.tsx';
import { Header } from './components/Header.tsx';
import { analyzeDocument } from './services/geminiService.ts';
import type { AnalysisResult } from './types.ts';
import { ChatAssistant } from './components/ChatAssistant.tsx';

const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn(`Geolocation error: ${error.message}`);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 600000, 
      }
    );
  });
};

type View = 'chat' | 'upload' | 'loading' | 'analysis';

const App: React.FC = () => {
  const [view, setView] = useState<View>('chat');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loadedPdfBlob, setLoadedPdfBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [loaderMessage, setLoaderMessage] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker('./services/report.worker.ts', {
      type: 'module',
    });

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, message, blob, result, fileName } = event.data;
      setIsLoading(false);

      if (type === 'progress') {
        setLoaderMessage(message);
        setIsLoading(true); // Keep loading state for progress messages
      } else if (type === 'success') {
        setCurrentFile(new File([blob], fileName, { type: 'application/pdf' }));
        setAnalysisResult(result);
        setLoadedPdfBlob(blob);
        setView('analysis');
      } else if (type === 'error') {
        setError(`Failed to load report: ${message}`);
        setView('upload');
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleFileAnalysis = useCallback(async (file: File) => {
    setIsLoading(true);
    setView('loading');
    setError(null);
    setAnalysisResult(null);
    setLoadedPdfBlob(null);
    setCurrentFile(file);
    setLoaderMessage('Acquiring jurisdictional context...');

    try {
      const location = await getCurrentLocation();
      const language = navigator.language || 'en-US';
      
      setLoaderMessage(null); // Switch to automated brain messages

      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) {
          setError('Failed to read file.');
          setIsLoading(false);
          setView('upload');
          return;
        }
        
        const dataUrl = event.target.result as string;
        const fileContent = dataUrl.split(',')[1];
        const fileType = file.type;

        try {
          const result = await analyzeDocument(fileContent, fileType, file.name, location, language);
          setAnalysisResult(result);
          setView('analysis');
        } catch (e: any) {
          console.error(e);
          setError(`Analysis failed: ${e.message}`);
          setView('upload'); // Go back to upload on error
        } finally {
          setIsLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('Error reading file.');
        setIsLoading(false);
        setView('upload');
      };

      reader.readAsDataURL(file);

    } catch (e: any) {
        console.error("Error during analysis setup:", e);
        setError(`An error occurred before file analysis: ${e.message}`);
        setIsLoading(false);
        setView('upload');
    }
  }, []);
  
  const handleReportUpload = useCallback((file: File) => {
    if (!workerRef.current) {
      setError('Report processing service is not available.');
      return;
    }
    setIsLoading(true);
    setView('loading');
    setError(null);
    setAnalysisResult(null);
    setCurrentFile(file);
    setLoadedPdfBlob(null);
    setLoaderMessage('Initializing report loader...');
    workerRef.current.postMessage(file);
  }, []);

  const handleReset = useCallback(() => {
    setView('chat');
    setAnalysisResult(null);
    setCurrentFile(null);
    setError(null);
    setIsLoading(false);
    setLoadedPdfBlob(null);
  }, []);

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Header onReset={handleReset} />
        <main className="mt-12">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6 animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-300">An Error Occurred</h3>
                  <div className="mt-2 text-sm text-red-400">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'chat' && <ChatAssistant onProceed={() => setView('upload')} />}
          {view === 'upload' && <FileUpload onFileUpload={handleFileAnalysis} onReportUpload={handleReportUpload} />}
          {view === 'loading' && currentFile && <Loader fileName={currentFile.name} message={loaderMessage} />}
          {view === 'analysis' && analysisResult && currentFile && (
            <AnalysisDisplay result={analysisResult} fileName={currentFile.name} onReset={handleReset} pdfBlob={loadedPdfBlob} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;