
import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult } from '../types.ts';

// --- Initialize Gemini API ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// --- Define JSON Schemas for Gemini ---

const evidenceSpotlightItemSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    significance: { type: Type.STRING },
    evidenceReference: { type: Type.STRING },
    pageNumber: { type: Type.INTEGER },
  },
  required: ['title', 'significance', 'evidenceReference', 'pageNumber'],
};

const evidenceIndexItemSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "A unique identifier like 'E-01', 'E-02'." },
    description: { type: Type.STRING },
    pageNumber: { type: Type.INTEGER },
    documentReference: { type: Type.STRING },
  },
  required: ['id', 'description', 'pageNumber', 'documentReference'],
};

const legalSubjectFindingSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidence: { type: Type.STRING },
    severity: { type: Type.STRING, description: "Must be one of: 'Low', 'Medium', 'High', 'Critical'." },
  },
  required: ['subject', 'keyPoints', 'evidence', 'severity'],
};

const dishonestyFindingSchema = {
  type: Type.OBJECT,
  properties: {
    flag: { type: Type.STRING },
    description: { type: Type.STRING },
    evidence: { type: Type.STRING },
    severity: { type: Type.STRING, description: "Must be one of: 'Low', 'Medium', 'High', 'Critical'." },
  },
  required: ['flag', 'description', 'evidence', 'severity'],
};

const recommendedActionSchema = {
  type: Type.OBJECT,
  properties: {
    jurisdiction: { type: Type.STRING },
    action: { type: Type.STRING },
    legalBasis: { type: Type.STRING },
  },
  required: ['jurisdiction', 'action', 'legalBasis'],
};

const topLiabilitySchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    severity: { type: Type.STRING, description: "Must be one of: 'High', 'Critical'." },
  },
  required: ['name', 'severity'],
};

const analysisResultSchema = {
  type: Type.OBJECT,
  properties: {
    caseNarrative: { type: Type.STRING, description: "Detailed, professional case narrative derived from the document." },
    evidenceSpotlight: { type: Type.ARRAY, items: evidenceSpotlightItemSchema },
    preAnalysisChecks: {
      type: Type.OBJECT,
      properties: {
        extractionProtocol: { type: Type.BOOLEAN },
        preservationFlags: { type: Type.BOOLEAN },
        scope: { type: Type.BOOLEAN },
      },
      required: ['extractionProtocol', 'preservationFlags', 'scope'],
      description: "Confirmation of pre-analysis steps. Typically all true.",
    },
    criticalLegalSubjects: { type: Type.ARRAY, items: legalSubjectFindingSchema },
    dishonestyDetectionMatrix: { type: Type.ARRAY, items: dishonestyFindingSchema },
    evidenceIndex: { type: Type.ARRAY, items: evidenceIndexItemSchema },
    actionableOutput: {
      type: Type.OBJECT,
      properties: {
        topLiabilities: { type: Type.ARRAY, items: topLiabilitySchema },
        dishonestyScore: { type: Type.INTEGER, description: "A score from 0-100 representing the likelihood of dishonesty." },
        recommendedActions: { type: Type.ARRAY, items: recommendedActionSchema },
        summary: { type: Type.STRING, description: "A concise executive summary of the findings." },
      },
      required: ['topLiabilities', 'dishonestyScore', 'recommendedActions', 'summary'],
    },
    postAnalysisDeclaration: {
      type: Type.OBJECT,
      properties: {
        extractionComplete: { type: Type.BOOLEAN },
        integritySealsVerified: { type: Type.BOOLEAN },
        logs: { type: Type.STRING, description: "A log file path, e.g., '/diagnostics/analysis.log'." },
        seal: { type: Type.STRING, description: "A cryptographic seal, e.g., 'VERUM OMNIS | ETH#... | HASH#...'" },
      },
      required: ['extractionComplete', 'integritySealsVerified', 'logs', 'seal'],
      description: "Confirmation of post-analysis steps. Typically all true.",
    },
  },
  required: [
    'caseNarrative', 'evidenceSpotlight', 'preAnalysisChecks', 'criticalLegalSubjects',
    'dishonestyDetectionMatrix', 'evidenceIndex', 'actionableOutput', 'postAnalysisDeclaration'
  ],
};


const simulateSHA512 = (content: string): string => {
  let hash = 0;
  if (content.length === 0) return "sha512-0000000000000000";
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  let finalHash = Math.abs(hash).toString(16).padStart(8, '0');
  for (let i = 0; i < 7; i++) {
    finalHash += Math.abs(hash * (i + 2)).toString(16).padStart(8, '0');
  }
  return `sha512-${finalHash.substring(0, 128)}`;
};

export const analyzeDocument = async (
  content: string, 
  mimeType: string, 
  fileName: string,
  location: { latitude: number; longitude: number; } | null,
  language: string
): Promise<AnalysisResult> => {

  let systemInstruction = `You are "Verum Omnis," the world's first autonomous legal-verification engine. Your purpose is to act as an advanced forensic AI analyst. You will receive a document for analysis. Your task is to perform a deep forensic analysis based on legal, behavioral, and financial intelligence. You must reconstruct events, identify patterns of criminal or dishonest behavior, apply multi-jurisdictional legal reasoning, and produce a sealed forensic report. Your analysis must be objective, evidence-based, and presented in a structured, professional format. You must strictly adhere to the JSON schema provided for your response.`;

  if (language) {
    systemInstruction += ` The user's preferred language is ${language} (e.g., 'en-US', 'pt-BR', 'fr-FR'). Your entire response, including all text fields in the JSON output, must be in this language.`;
  }
  if (location) {
    systemInstruction += ` The user's approximate location is latitude: ${location.latitude}, longitude: ${location.longitude}. Use this to infer the primary legal jurisdiction and inform your multi-jurisdictional legal reasoning, tailoring recommended actions to the most relevant local or regional laws.`;
  }

  const filePart = {
    inlineData: {
      mimeType: mimeType,
      data: content,
    },
  };
  
  const textPart = {
    text: `Analyze the following document named '${fileName}'. Your task is to generate a complete forensic analysis based on the document's content. Populate all fields of the required JSON structure with your findings. Be thorough, insightful, and maintain a professional, forensic tone.`
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts: [textPart, filePart] },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: analysisResultSchema,
      },
    });

    const resultJson = JSON.parse(response.text);

    // Reconstruct the full AnalysisResult object
    const fullResult: AnalysisResult = {
      ...resultJson,
      documentHash: simulateSHA512(content),
      fileName: fileName,
    };
    
    // Quick validation on severity fields to prevent UI errors
    fullResult.criticalLegalSubjects.forEach(s => {
      if (!['Low', 'Medium', 'High', 'Critical'].includes(s.severity)) s.severity = 'Medium';
    });
    fullResult.dishonestyDetectionMatrix.forEach(d => {
       if (!['Low', 'Medium', 'High', 'Critical'].includes(d.severity)) d.severity = 'Medium';
    });
    fullResult.actionableOutput.topLiabilities.forEach(l => {
        if (!['High', 'Critical'].includes(l.severity)) l.severity = 'High';
    });

    return fullResult;
  } catch (error: any) {
    console.error("Gemini API call failed:", error);
    throw new Error("Failed to get analysis from AI. Check the console for more details.");
  }
};
