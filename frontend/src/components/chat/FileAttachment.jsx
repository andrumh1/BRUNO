import React from "react";
import BrunoAudioWaveform from "@/components/bruno/BrunoAudioWaveform";
import { Image as ImageIcon, Mic, Video, File, Download } from "lucide-react";

/**
 * FileAttachment — renders a chat attachment depending on its mime type.
 * - image / video  → inline preview
 * - audio          → BrunoAudioWaveform (multi-source playback)
 * - everything else → downloadable file card
 */
const FileAttachment = ({ file, isOwn }) => {
  const getFileIcon = (type) => {
    if (type?.startsWith("image")) return ImageIcon;
    if (type?.startsWith("video")) return Video;
    if (type?.startsWith("audio")) return Mic;
    return File;
  };

  const Icon = getFileIcon(file.type);
  const isMedia = file.type?.startsWith("image") || file.type?.startsWith("video");

  if (isMedia) {
    return (
      <div className="max-w-[280px] rounded-xl overflow-hidden">
        {file.type?.startsWith("image") ? (
          <img src={file.url} alt={file.filename} className="w-full" />
        ) : (
          <video src={file.url} controls className="w-full" />
        )}
      </div>
    );
  }

  if (file.type?.startsWith("audio")) {
    return <BrunoAudioWaveform url={file.url} mp3Url={file.mp3_url} isOwn={isOwn} />;
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl ${
        isOwn ? "bg-white/10 hover:bg-white/20" : "bg-muted hover:bg-muted/80"
      } transition-colors`}
    >
      <div className={`p-2 rounded-lg ${isOwn ? "bg-white/20" : "bg-primary/10"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.filename}</p>
        <p className={`text-xs ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>
          {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Archivo"}
        </p>
      </div>
      <Download className="w-4 h-4 opacity-60" />
    </a>
  );
};

export default FileAttachment;
