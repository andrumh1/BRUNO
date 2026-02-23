import React, { useState, useEffect, useCallback } from "react";
import { DailyProvider, useDaily, useParticipantIds, useLocalParticipant, useMeetingState, useVideoTrack, useAudioTrack } from "@daily-co/daily-react";
import { Button } from "@/components/ui/button";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Maximize,
  Minimize,
  X,
  Loader2,
  User
} from "lucide-react";

// Video Tile Component
const VideoTile = ({ participantId, isLocal, isLarge }) => {
  const videoTrack = useVideoTrack(participantId);
  const audioTrack = useAudioTrack(participantId);
  const videoRef = React.useRef(null);
  const audioRef = React.useRef(null);

  useEffect(() => {
    if (videoTrack?.track && videoRef.current) {
      videoRef.current.srcObject = new MediaStream([videoTrack.track]);
    }
  }, [videoTrack?.track]);

  useEffect(() => {
    if (audioTrack?.track && audioRef.current && !isLocal) {
      audioRef.current.srcObject = new MediaStream([audioTrack.track]);
    }
  }, [audioTrack?.track, isLocal]);

  return (
    <div className={`relative bg-black rounded-2xl overflow-hidden ${isLarge ? 'w-full h-full' : 'w-32 h-24'}`}>
      {videoTrack?.state === 'playable' ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
          <User className={`${isLarge ? 'w-24 h-24' : 'w-8 h-8'} text-primary/50`} />
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay />}
      {isLocal && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
          Tú
        </div>
      )}
    </div>
  );
};

// Call Controls
const CallControls = ({ onLeave }) => {
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const toggleCamera = useCallback(() => {
    if (daily) {
      daily.setLocalVideo(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  }, [daily, isCameraOn]);

  const toggleMic = useCallback(() => {
    if (daily) {
      daily.setLocalAudio(!isMicOn);
      setIsMicOn(!isMicOn);
    }
  }, [daily, isMicOn]);

  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant={isMicOn ? "secondary" : "destructive"}
        size="icon"
        className="w-14 h-14 rounded-full"
        onClick={toggleMic}
      >
        {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
      </Button>
      
      <Button
        variant="destructive"
        size="icon"
        className="w-16 h-16 rounded-full"
        onClick={onLeave}
      >
        <PhoneOff className="w-7 h-7" />
      </Button>
      
      <Button
        variant={isCameraOn ? "secondary" : "destructive"}
        size="icon"
        className="w-14 h-14 rounded-full"
        onClick={toggleCamera}
      >
        {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
      </Button>
    </div>
  );
};

// Main Call View
const CallView = ({ onLeave, remoteUserName }) => {
  const participantIds = useParticipantIds({ filter: 'remote' });
  const localParticipant = useLocalParticipant();
  const meetingState = useMeetingState();

  if (meetingState === 'joining-meeting') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Conectando...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main video area */}
      <div className="flex-1 relative p-4">
        {participantIds.length > 0 ? (
          <VideoTile participantId={participantIds[0]} isLarge={true} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/50 rounded-2xl">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-primary/50" />
            </div>
            <p className="text-lg font-medium">{remoteUserName || "Usuario"}</p>
            <p className="text-sm text-muted-foreground">Esperando que se conecte...</p>
          </div>
        )}
        
        {/* Local video (picture-in-picture) */}
        {localParticipant && (
          <div className="absolute bottom-6 right-6 shadow-xl">
            <VideoTile participantId={localParticipant.session_id} isLocal={true} />
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="p-6 bg-card/80 backdrop-blur-xl border-t">
        <CallControls onLeave={onLeave} />
      </div>
    </div>
  );
};

// Video Call Modal Component
const VideoCallModal = ({ 
  isOpen, 
  onClose, 
  roomUrl, 
  remoteUserName,
  isIncoming,
  onAccept,
  onDecline,
  callType = "video" // "video" or "audio"
}) => {
  const [callObject, setCallObject] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callState, setCallState] = useState('idle'); // idle, ringing, connected
  const [callDuration, setCallDuration] = useState(0);
  const containerRef = React.useRef(null);
  const durationTimerRef = React.useRef(null);
  
  const isAudioOnly = callType === "audio";

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize call
  useEffect(() => {
    if (!isOpen || !roomUrl) return;

    const initCall = async () => {
      try {
        const Daily = (await import('@daily-co/daily-js')).default;
        const newCallObject = Daily.createCallObject({
          videoSource: !isAudioOnly, // Disable video for audio-only calls
          audioSource: true,
        });
        
        newCallObject.on('joining-meeting', () => setCallState('connecting'));
        newCallObject.on('joined-meeting', () => {
          setCallState('connected');
          // Start duration timer
          durationTimerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        });
        newCallObject.on('left-meeting', () => {
          setCallState('idle');
          if (durationTimerRef.current) clearInterval(durationTimerRef.current);
          onClose();
        });
        newCallObject.on('error', (e) => {
          console.error('Daily error:', e);
          onClose();
        });
        
        setCallObject(newCallObject);
        
        if (!isIncoming) {
          await newCallObject.join({ url: roomUrl });
        }
      } catch (error) {
        console.error('Error initializing call:', error);
        onClose();
      }
    };

    initCall();

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (callObject) {
        callObject.leave();
        callObject.destroy();
      }
    };
  }, [isOpen, roomUrl, isIncoming, isAudioOnly]);

  const handleAccept = async () => {
    if (callObject && roomUrl) {
      await callObject.join({ url: roomUrl });
      onAccept?.();
    }
  };

  const handleLeave = () => {
    if (callObject) {
      callObject.leave();
    }
    onClose();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  // Incoming call UI
  if (isIncoming && callState === 'idle') {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-3xl p-8 max-w-sm w-full text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse ${
            isAudioOnly 
              ? "bg-gradient-to-br from-green-500 to-green-600" 
              : "bg-gradient-to-br from-primary to-primary/60"
          }`}>
            <Phone className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-xl font-bold mb-2">
            {isAudioOnly ? "Llamada de voz" : "Videollamada"} entrante
          </h3>
          <p className="text-muted-foreground mb-8">{remoteUserName || "Usuario"}</p>
          
          <div className="flex justify-center gap-6">
            <Button
              variant="destructive"
              size="lg"
              className="w-16 h-16 rounded-full"
              onClick={() => { onDecline?.(); onClose(); }}
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
            <Button
              size="lg"
              className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
            >
              <Phone className="w-7 h-7" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Audio-only call UI - Minimalist design
  if (isAudioOnly) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
        <div className="bg-gradient-to-b from-gray-900 to-black rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          {/* Animated audio waves */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute inset-2 bg-green-500/30 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.3s' }} />
            <div className="absolute inset-4 bg-green-500/40 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.6s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                <Phone className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          
          {/* User name */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {remoteUserName || "Usuario"}
          </h2>
          
          {/* Call status */}
          <p className="text-green-400 text-sm mb-6">
            {callState === 'connecting' && "Conectando..."}
            {callState === 'connected' && formatDuration(callDuration)}
          </p>
          
          {/* Audio controls */}
          {callObject && (
            <DailyProvider callObject={callObject}>
              <AudioOnlyControls onLeave={handleLeave} />
            </DailyProvider>
          )}
        </div>
      </div>
    );
  }

  // Video call UI
  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-background ${isFullscreen ? '' : 'p-4 md:p-8'}`}
    >
      <div className={`h-full bg-card rounded-2xl overflow-hidden shadow-2xl flex flex-col ${isFullscreen ? 'rounded-none' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-full flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{remoteUserName || "Videollamada"}</h3>
              <p className="text-xs text-muted-foreground">
                {callState === 'connecting' && "Conectando..."}
                {callState === 'connected' && formatDuration(callDuration)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLeave}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Call content */}
        {callObject && (
          <DailyProvider callObject={callObject}>
            <CallView onLeave={handleLeave} remoteUserName={remoteUserName} />
          </DailyProvider>
        )}
      </div>
    </div>
  );
};

export default VideoCallModal;
