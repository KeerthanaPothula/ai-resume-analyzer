import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/layout/Layout';
import { resumeApi } from '../lib/api';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadedResumeId, setUploadedResumeId] = useState<number | null>(null);
  const navigate = useNavigate();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0]);
      setUploadState('idle');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejected) => {
      if (rejected[0]?.errors[0]?.code === 'file-too-large') toast.error('File too large (max 10MB)');
      else toast.error('Only PDF and DOCX files are supported');
    },
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploadState('uploading');
    try {
      const res = await resumeApi.upload(file);
      setUploadedResumeId(res.data.id);
      setUploadState('success');
      toast.success('Resume uploaded and analyzed!');
    } catch (err: any) {
      setUploadState('error');
      toast.error(err.response?.data?.detail || 'Upload failed');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Upload Resume</h1>
          <p className="text-slate-400 mt-1">Upload your resume for AI-powered analysis and ATS scoring</p>
        </div>

        <AnimatePresence mode="wait">
          {uploadState === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-12 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Resume Analyzed!</h2>
              <p className="text-slate-400 mb-8">Your resume has been parsed and scored by our AI engine.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => uploadedResumeId && navigate(`/analysis/${uploadedResumeId}`)}
                  className="btn-primary"
                >
                  View Analysis
                </button>
                <button
                  onClick={() => { setFile(null); setUploadState('idle'); }}
                  className="btn-secondary"
                >
                  Upload Another
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-sky-400 bg-sky-500/10'
                    : file
                    ? 'border-violet-500/50 bg-violet-500/5'
                    : 'border-slate-600 hover:border-sky-500/50 hover:bg-sky-500/5'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    isDragActive ? 'bg-sky-500/20 border border-sky-500/40 scale-110' : 'bg-slate-700/50 border border-slate-600'
                  }`}>
                    <Upload className={`w-8 h-8 ${isDragActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  </div>
                  {isDragActive ? (
                    <p className="text-sky-400 font-medium text-lg">Drop it here!</p>
                  ) : (
                    <>
                      <div>
                        <p className="text-white font-medium text-lg">Drag & drop or click to upload</p>
                        <p className="text-slate-400 text-sm mt-1">Supports PDF, DOCX — Max 10MB</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* File preview */}
              {file && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 card p-4 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-sky-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{file.name}</p>
                    <p className="text-slate-400 text-sm">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setUploadState('idle'); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {uploadState === 'error' && (
                <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">Upload failed. Please try again.</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploadState === 'uploading'}
                className="btn-primary w-full justify-center mt-6 py-3 text-base"
              >
                {uploadState === 'uploading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Upload & Analyze
                  </>
                )}
              </button>

              {/* Info */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {['Skills Extraction', 'ATS Scoring', 'AI Feedback'].map((item) => (
                  <div key={item} className="card p-3 text-center">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                    <p className="text-slate-300 text-xs">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
