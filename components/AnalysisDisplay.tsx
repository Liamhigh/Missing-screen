
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { AnalysisResult } from '../types.ts';
import { DownloadIcon, ResetIcon, CopyIcon, CheckIcon, CheckboxIcon, GavelIcon, EyeIcon, TargetIcon, AlertTriangleIcon, CheckCircleIcon, FileTextIcon, StarIcon, ChevronDownIcon, BinaryIcon } from './icons.tsx';
import { encodeReport } from '../services/reportSerializer.ts';

interface AnalysisDisplayProps {
  result: AnalysisResult;
  file: File;
  onReset: () => void;
  pdfBlob?: Blob | null;
  onGeneratePdfRequest: (result: AnalysisResult, fileName: string) => void;
  isGeneratingPdf: boolean;
}

interface EvidenceViewerProps {
  file: File | Blob | null;
  pageNumber?: number | null;
}

const EvidenceViewer: React.FC<EvidenceViewerProps> = ({ file, pageNumber }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
    setFileUrl(null);
  }, [file]);


  if (!file || !fileUrl) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center h-full aspect-[3/4]">
        <p className="text-gray-400">No evidence file to preview.</p>
      </div>
    );
  }

  const isPdf = file.type === 'application/pdf';
  const isImage = file.type.startsWith('image/');

  const finalUrl = isPdf && pageNumber ? `${fileUrl}#page=${pageNumber}` : fileUrl;

  return (
    <>
      <h3 className="text-xl font-bold text-gray-200 mb-4">Evidence Preview</h3>
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg aspect-[3/4] overflow-hidden">
        {isPdf ? (
          <iframe
            key={finalUrl} 
            src={finalUrl}
            className="w-full h-full"
            title="Evidence Preview"
            frameBorder="0"
          />
        ) : isImage ? (
          <img src={fileUrl} alt="Evidence Preview" className="w-full h-full object-contain" />
        ) : (
          <div className="p-8 flex items-center justify-center h-full">
            <p className="text-gray-400 text-center">Preview is not available for this file type ({file.type}).</p>
          </div>
        )}
      </div>
      {isPdf && pageNumber && (
        <p className="text-center text-sm text-gray-400 mt-2">Navigated to page {pageNumber}</p>
      )}
    </>
  );
};


const SeverityBadge: React.FC<{ severity: 'Low' | 'Medium' | 'High' | 'Critical' }> = ({ severity }) => {
  const styles = {
    Low: 'bg-gray-600 text-gray-200',
    Medium: 'bg-yellow-600 text-yellow-100',
    High: 'bg-orange-600 text-orange-100',
    Critical: 'bg-red-600 text-red-100',
  };
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[severity]}`}>{severity}</span>;
};

const SeverityDots: React.FC<{ severity: 'Low' | 'Medium' | 'High' | 'Critical' }> = ({ severity }) => {
    const dotStyles = {
        Low: 'text-gray-500',
        Medium: 'text-yellow-500',
        High: 'text-orange-500',
        Critical: 'text-red-500',
    };
    const dotCount = { Low: 1, Medium: 2, High: 3, Critical: 3 }[severity];
    const dots = '●'.repeat(dotCount);
    return <span className={`mr-2 font-bold text-lg ${dotStyles[severity]}`}>{dots}</span>;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg backdrop-blur-sm animate-fade-in">
      <button
        className="flex items-center justify-between w-full p-4 border-b border-gray-700 bg-gray-800/30 hover:bg-gray-800/60 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center">
            {icon}
            <h3 className="text-xl font-bold text-gray-200 ml-3">{title}</h3>
        </div>
        <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="p-6">
          {children}
        </div>
      )}
    </div>
  );
};

export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, file, onReset, pdfBlob, onGeneratePdfRequest, isGeneratingPdf }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [isEncoding, setIsEncoding] = useState(false);
  const [isHashCopied, setIsHashCopied] = useState(false);
  const [targetPage, setTargetPage] = useState<number | null>(null);
  const fileName = file.name;
  
  const handleCopyHash = useCallback(() => {
    navigator.clipboard.writeText(result.documentHash).then(() => {
        setIsHashCopied(true);
        setTimeout(() => setIsHashCopied(false), 2500);
    }).catch((err: any) => console.error('Failed to copy text: ', err));
  }, [result.documentHash]);

  const handleDownloadPdfReport = useCallback(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safeFileName}_verum_omnis_report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      onGeneratePdfRequest(result, fileName);
    }
  }, [result, fileName, pdfBlob, onGeneratePdfRequest]);

  const handleDownloadBinaryReport = useCallback(async () => {
    setIsEncoding(true);
    try {
      const buffer = encodeReport(result);
      if (buffer) {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeFileName}.verum.bin`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error("Error encoding report:", error);
      alert("An error occurred while encoding the report. See console for details.");
    } finally {
      setIsEncoding(false);
    }
  }, [result, fileName]);

  const tabs = [
    { id: 'summary', label: 'Summary & Actions', icon: <TargetIcon className="w-5 h-5 mr-2" /> },
    { id: 'narrative', label: 'Case Narrative', icon: <FileTextIcon className="w-5 h-5 mr-2" /> },
    { id: 'evidence', label: 'Evidence', icon: <StarIcon className="w-5 h-5 mr-2" /> },
    { id: 'legal', label: 'Legal & Dishonesty', icon: <GavelIcon className="w-5 h-5 mr-2" /> },
    { id: 'declarations', label: 'Declarations', icon: <CheckboxIcon className="w-5 h-5 mr-2" /> },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-100 font-roboto-mono">DEEPSEEK VERUM OMNIS: INSTITUTIONAL REVIEW</h2>
        <p className="text-gray-400 mt-1">Forensic Analysis of: <span className="font-semibold text-gray-200">{fileName}</span></p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 lg:w-1/2">
            <div className="mb-6 border-b border-gray-700 flex flex-wrap -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-3 text-sm font-semibold rounded-t-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {activeTab === 'summary' && (
                <CollapsibleSection title="Actionable Output" icon={<TargetIcon className="w-7 h-7 text-teal-400"/>}>
                  <div className="space-y-6">
                      <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                          <h4 className="text-lg font-bold text-gray-100 mb-2">Top Liabilities</h4>
                          <ul className="space-y-2">
                          {result.actionableOutput.topLiabilities.map((item, i) => (
                              <li key={i} className="flex items-center text-gray-300 p-2 bg-gray-800/50 rounded-md">
                                  <AlertTriangleIcon className={`w-5 h-5 mr-3 flex-shrink-0 ${item.severity === 'Critical' ? 'text-red-400' : 'text-orange-400'}`} />
                                  <span>{item.name}</span>
                              </li>
                          ))}
                          </ul>
                      </div>

                      <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-700">
                          <div className="flex justify-between items-baseline mb-1">
                            <h4 className="text-lg font-bold text-gray-100">Dishonesty Score</h4>
                            <span className="font-bold text-3xl text-red-400">{result.actionableOutput.dishonestyScore}<span className="text-xl">%</span></span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                              <div className="bg-gradient-to-r from-orange-500 to-red-600 h-2.5 rounded-full" style={{ width: `${result.actionableOutput.dishonestyScore}%` }}></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 text-right">{result.actionableOutput.dishonestyScore}% of logs contain red flags or liability triggers.</p>
                      </div>

                      <div>
                          <h4 className="text-lg font-bold text-gray-100 mb-3">Recommended Actions</h4>
                          <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                  <thead className="bg-gray-700/50 text-gray-300">
                                      <tr>
                                          <th className="p-3 rounded-tl-lg">Jurisdiction</th>
                                          <th className="p-3">Action</th>
                                          <th className="p-3 rounded-tr-lg">Legal Basis</th>
                                      </tr>
                                  </thead>
                                  <tbody className="text-gray-300">
                                  {result.actionableOutput.recommendedActions.map((item, i) => (
                                      <tr key={i} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-800/40">
                                          <td className="p-3 font-semibold">{item.jurisdiction}</td>
                                          <td className="p-3" dangerouslySetInnerHTML={{ __html: item.action.replace(/(\(E-\d+\))/g, '<strong class="text-teal-300">$1</strong>') }}></td>
                                          <td className="p-3 font-mono text-gray-400">{item.legalBasis}</td>
                                      </tr>
                                  ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
                </CollapsibleSection>
              )}
              {activeTab === 'narrative' && (
                 <CollapsibleSection title="Case Narrative" icon={<FileTextIcon className="w-7 h-7 text-gray-300"/>}>
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{result.caseNarrative}</p>
                </CollapsibleSection>
              )}
              {activeTab === 'evidence' && (
                <>
                  <CollapsibleSection title="Evidence Spotlight: Critical Findings" icon={<StarIcon className="w-7 h-7 text-yellow-400"/>}>
                      <div className="space-y-4">
                          {result.evidenceSpotlight.map((item, index) => (
                              <div key={index} onClick={() => setTargetPage(item.pageNumber)} className="p-4 bg-yellow-900/20 border-l-4 border-yellow-500 rounded-r-md cursor-pointer hover:bg-yellow-900/40 transition-colors">
                                  <h4 className="text-lg font-bold text-yellow-300">★ {item.title} (Page {item.pageNumber})</h4>
                                  <p className="text-yellow-200 mt-2">{item.significance}</p>
                              </div>
                          ))}
                      </div>
                  </CollapsibleSection>
                  <CollapsibleSection title="Evidence Index" icon={<FileTextIcon className="w-7 h-7 text-gray-300"/>}>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-gray-700/50 text-gray-300">
                                  <tr>
                                      <th className="p-3 rounded-tl-lg">ID</th>
                                      <th className="p-3">Description</th>
                                      <th className="p-3 rounded-tr-lg">Page</th>
                                  </tr>
                              </thead>
                              <tbody className="text-gray-300">
                              {result.evidenceIndex.map((item, i) => (
                                  <tr key={i} onClick={() => setTargetPage(item.pageNumber)} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-800/40 cursor-pointer transition-colors">
                                      <td className="p-3 font-mono text-gray-400">{item.id}</td>
                                      <td className="p-3">{item.description}</td>
                                      <td className="p-3 font-semibold">{item.pageNumber}</td>
                                  </tr>
                              ))}
                              </tbody>
                          </table>
                      </div>
                  </CollapsibleSection>
                </>
              )}
              {activeTab === 'legal' && (
                <>
                  <CollapsibleSection title="Critical Legal Subjects" icon={<GavelIcon className="w-7 h-7 text-amber-400"/>}>
                      <div className="space-y-4">
                          {result.criticalLegalSubjects.length > 0 ? result.criticalLegalSubjects.map((item, index) => (
                              <div key={index} className="p-4 rounded-lg bg-gray-900/40 border border-gray-700/80 transition-shadow hover:shadow-lg hover:border-gray-600">
                                  <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-lg font-bold text-gray-100">{item.subject}</h4>
                                      <SeverityBadge severity={item.severity} />
                                  </div>
                                  <div className="space-y-2 mt-3">
                                    <p className="text-sm text-gray-400"><strong className="font-semibold text-gray-300">Key Points:</strong> {item.keyPoints.join(', ')}</p>
                                    <p className="text-sm text-gray-300"><strong className="font-semibold text-gray-300">Evidence:</strong> <span dangerouslySetInnerHTML={{ __html: item.evidence.replace(/(\(Page \d+\))/g, '<strong class="text-amber-300">$1</strong>') }}></span></p>
                                  </div>
                              </div>
                          )) : <p className="text-gray-400">No critical legal subjects were flagged in this analysis.</p>}
                      </div>
                  </CollapsibleSection>
                  <CollapsibleSection title="Dishonesty Detection Matrix" icon={<EyeIcon className="w-7 h-7 text-purple-400"/>}>
                      <div className="space-y-4">
                          {result.dishonestyDetectionMatrix.length > 0 ? result.dishonestyDetectionMatrix.map((item, index) => (
                               <div key={index} className="p-4 rounded-lg bg-gray-900/40 border border-gray-700/80 transition-shadow hover:shadow-lg hover:border-gray-600">
                                  <div className="flex items-start">
                                      <SeverityDots severity={item.severity} />
                                      <div className="flex-1">
                                          <h4 className="font-bold text-gray-200">{item.flag}</h4>
                                          <p className="text-gray-300">{item.description}</p>
                                          <p className="text-sm text-gray-400 mt-2 pt-2 border-t border-gray-700" dangerouslySetInnerHTML={{ __html: `<strong>Evidence:</strong> ${item.evidence.replace(/(\(Page \d+\))/g, '<strong class="text-purple-300">$1</strong>')}` }}></p>
                                      </div>
                                  </div>
                               </div>
                          )) : <p className="text-gray-400">No patterns of dishonesty were detected.</p>}
                      </div>
                  </CollapsibleSection>
                </>
              )}
              {activeTab === 'declarations' && (
                <>
                  <CollapsibleSection title="Pre-Analysis Declaration" icon={<CheckboxIcon className="w-7 h-7 text-blue-400"/>} defaultOpen={false}>
                      <ul className="space-y-2 text-gray-300">
                          <li className="flex items-center"><CheckCircleIcon className="w-5 h-5 text-green-400 mr-2"/>Initiating extraction under Forensic-Chain Protocol</li>
                          <li className="flex items-center"><CheckCircleIcon className="w-5 h-5 text-green-400 mr-2"/>Preservation flags engaged: WATERMARKS, SEALS, BEHAVIORAL MATRICES</li>
                          <li className="flex items-center"><CheckCircleIcon className="w-5 h-5 text-green-400 mr-2"/>Scope: Entire file content and metadata</li>
                      </ul>
                  </CollapsibleSection>
                  <CollapsibleSection title="Post-Analysis Declaration" icon={<CheckboxIcon className="w-7 h-7 text-blue-400"/>} defaultOpen={false}>
                      <ul className="space-y-2 text-gray-300 mb-4">
                          <li className="flex items-center"><CheckCircleIcon className="w-5 h-5 text-green-400 mr-2"/>Extraction complete. Integrity seals verified.</li>
                          <li className="flex items-center"><CheckCircleIcon className="w-5 h-5 text-green-400 mr-2"/>Contradictions/redaction breaks logged in: <span className="font-mono ml-2 text-gray-400">{result.postAnalysisDeclaration.logs}</span></li>
                          <li className="flex items-center"><CheckCircleIcon className="w-5 h-5 text-green-400 mr-2"/>Ready for redeployment: New case initialization unlocked.</li>
                      </ul>
                      <div className="mt-4 pt-4 border-t border-gray-700/50">
                          <div className="flex items-center justify-between font-mono text-xs">
                              <p className="text-gray-400 break-all">{result.postAnalysisDeclaration.seal}</p>
                              <div className="flex items-center ml-4">
                                  <p className="text-gray-500 mr-2">SHA-512:</p>
                                  <p className="text-gray-400 truncate">{result.documentHash.substring(0,40)}...</p>
                                  <button onClick={handleCopyHash} className="ml-2 p-1.5 rounded-md bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-white">
                                      {isHashCopied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </CollapsibleSection>
                </>
              )}
            </div>
        </div>
        <div className="flex-1 lg:w-1/2">
            <div className="lg:sticky lg:top-8">
                <EvidenceViewer file={file} pageNumber={targetPage} />
            </div>
        </div>
      </div>
     
      <div className="mt-8 text-center flex items-center justify-center space-x-4 flex-wrap gap-y-4">
        <button onClick={handleDownloadPdfReport} disabled={isGeneratingPdf} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-75">
          <DownloadIcon className="w-5 h-5" />
          <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF Report'}</span>
        </button>
        <button
          onClick={handleDownloadBinaryReport}
          disabled={isEncoding}
          className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2 disabled:opacity-75"
        >
          <BinaryIcon className="w-5 h-5" />
          <span>{isEncoding ? 'Encoding...' : 'Save .bin Report'}</span>
        </button>
        <button onClick={onReset} className="px-6 py-3 bg-gray-700/50 border border-gray-600 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 flex items-center space-x-2">
          <ResetIcon className="w-5 h-5" />
          <span>Analyze New File</span>
        </button>
      </div>
    </div>
  );
};
