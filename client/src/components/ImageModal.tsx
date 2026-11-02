import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action bar */}
        <div className="absolute top-3 right-3 flex items-center space-x-2 bg-slate-900/80 p-1.5 rounded-full backdrop-blur-md z-10">
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition"
            title="Open in new tab"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <a
            href={imageUrl}
            download
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition"
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Full Image */}
        <img
          src={imageUrl}
          alt="Enlarged chat attachment"
          className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl border border-slate-700/50"
        />
      </div>
    </div>
  );
};
