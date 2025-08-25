const socket = io();
let recognition;
let isListening = false;
let isSpeaking = false;
let conversationActive = false;
let currentUtterance = null;
let lastTranscript = "";
let isInitialized = false;
let restartRecognitionTimeout = null;
let userSpeechBuffer = [];
let isProcessingUserSpeech = false;
let interruptedByUser = false;
let audioContext = null;
let analyser = null;
let microphone = null;
let isUserMakingSound = false;
let soundDetectionTimeout = null;
let isGreeting = false; // Track if AI is giving greeting
let isThinking = false; // Track if system is processing

// DOM Elements - with error handling
const micBtn = document.getElementById("micBtn");
const indicator = document.getElementById("voiceIndicator");
const themeToggle = document.getElementById("themeToggle");

// Check if elements exist
if (!micBtn) {
  console.error("Mic button not found!");
}
if (!indicator) {
  console.error("Voice indicator not found!");
}

// Theme toggle functionality
if (themeToggle) {
  themeToggle.addEventListener('change', function() {
    document.body.classList.toggle('light', this.checked);
  });
}

// Update UI state
function updateUIState() {
  const waveBars = document.querySelectorAll('.wave-bar');
  
  if (!conversationActive) {
    // Idle state
    if (micBtn) micBtn.classList.remove("active");
    if (indicator) indicator.textContent = "Tap mic to talk";
    resetWaveBars();
  } else if (isSpeaking) {
    // AI speaking state
    if (micBtn) micBtn.classList.add("active");
    if (indicator) indicator.textContent = "Speaking… (tap to stop)";
    animateWaveBars('ai');
  } else if (isListening) {
    // Listening state
    if (micBtn) micBtn.classList.add("active");
    if (indicator) indicator.textContent = "Listening… (tap to stop)";
    animateWaveBars('user');
  } else if (isThinking) {
    // Thinking state
    if (micBtn) micBtn.classList.add("active");
    if (indicator) indicator.textContent = "Thinking… (tap to stop)";
    resetWaveBars();
  } else {
    // Ready state
    if (micBtn) micBtn.classList.add("active");
    if (indicator) indicator.textContent = "Ready to listen… (tap to stop)";
    resetWaveBars();
  }
}

// Animate wave bars based on who is speaking
function animateWaveBars(speaker) {
  const waveBars = document.querySelectorAll('.wave-bar');
  waveBars.forEach(bar => {
    bar.classList.remove('user', 'ai');
    if (speaker) {
      bar.classList.add(speaker);
    }
  });
}

// Reset wave bars to default state
function resetWaveBars() {
  const waveBars = document.querySelectorAll('.wave-bar');
  waveBars.forEach(bar => {
    bar.classList.remove('user', 'ai');
  });
}

// Initialize Sound Detection for interruption (only during AI responses, not greeting)
function initSoundDetection() {
  try {
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    // Get microphone input
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(function(stream) {
        microphone = audioContext.createMediaStreamSource(stream);
        
        // Set up to receive audio data
        microphone.connect(analyser);
        
        // Process audio data to detect sound
        function detectSound() {
          // Only detect when AI is speaking AND it's not a greeting
          if (!isSpeaking || isGreeting) return;
          
          const array = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(array);
          
          // Calculate average volume
          let values = 0;
          for (let i = 0; i < array.length; i++) {
            values += array[i];
          }
          const average = values / array.length;
          
          // Detect if user is making sound (threshold can be adjusted)
          if (average > 25) { // Lower threshold for better detection
            if (!isUserMakingSound) {
              isUserMakingSound = true;
              console.log("User sound detected, interrupting AI response");
              stopSpeaking();
              
              // Start listening for speech
              setTimeout(() => {
                startListening();
              }, 100);
            }
            
            // Reset timeout
            if (soundDetectionTimeout) {
              clearTimeout(soundDetectionTimeout);
            }
            soundDetectionTimeout = setTimeout(() => {
              isUserMakingSound = false;
            }, 1000);
          }
          
          // Continue monitoring only if AI is speaking and it's not a greeting
          if (isSpeaking && !isGreeting) {
            requestAnimationFrame(detectSound);
          }
        }
        
        // Start sound detection
        detectSound();
      })
      .catch(function(err) {
        console.log("Microphone access error:", err);
      });
  } catch (e) {
    console.log("Sound detection initialization error:", e);
  }
}

// Initialize Speech Recognition
function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (indicator) indicator.textContent = "Speech recognition not supported";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true; // Keep it continuous for full duplex
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isListening = true;
    isThinking = false; // Clear thinking state when listening starts
    console.log("Recognition started - FULL DUPLEX MODE");
    updateUIState();
  };

  // Try to use built-in events if available (only during AI responses, not greeting)
  if (recognition.onsoundstart) {
    recognition.onsoundstart = () => {
      console.log("Sound detected - user might be speaking");
      // Only interrupt if AI is speaking and it's not a greeting
      if (isSpeaking && !isGreeting) {
        console.log("Interrupting AI response - user started speaking");
        stopSpeaking();
      }
    };
  }

  if (recognition.onspeechstart) {
    recognition.onspeechstart = () => {
      console.log("Speech detected - interrupting AI");
      // Only interrupt if AI is speaking and it's not a greeting
      if (isSpeaking && !isGreeting) {
        console.log("Interrupting AI response - user started speaking");
        stopSpeaking();
      }
    };
  }

  recognition.onresult = (e) => {
    const results = e.results;
    const latestResult = results[results.length - 1];
    const transcript = latestResult[0].transcript.trim();
    
    // Store interim results in buffer
    if (!latestResult.isFinal) {
      if (transcript && transcript.length > 2) {
        userSpeechBuffer.push(transcript);
        // NEW: Interrupt immediately on interim speech while AI is speaking (not during greeting)
        if (isSpeaking && !isGreeting && !interruptedByUser) {
          console.log("Interim speech detected → interrupting AI now");
          interruptedByUser = true;
          stopSpeaking();
        }
      }
      return;
    }
    
    // Process final result
    if (transcript && transcript !== lastTranscript && transcript.length > 2) {
      lastTranscript = transcript;
      console.log("User said (FINAL):", transcript);
      
      // If AI is speaking and it's not a greeting, interrupt immediately but keep listening
      if (isSpeaking && !isGreeting) {
        console.log("Interrupting AI response for user query but KEEPING LISTENING");
        interruptedByUser = true;
        stopSpeaking();
        
        // Store the query to process after interruption
        setTimeout(() => {
          processUserQuery(transcript);
        }, 100);
      } else {
        // Process query normally
        processUserQuery(transcript);
      }
    }
    
    // Clear buffer
    userSpeechBuffer = [];
  };

  recognition.onend = () => {
    isListening = false;
    console.log("Recognition ended");
    
    // Process any buffered speech if not already processing
    if (userSpeechBuffer.length > 0 && !isProcessingUserSpeech && !interruptedByUser) {
      const latestTranscript = userSpeechBuffer[userSpeechBuffer.length - 1];
      if (latestTranscript && latestTranscript !== lastTranscript && latestTranscript.length > 2) {
        processUserQuery(latestTranscript);
      }
    }
    
    interruptedByUser = false;
    
    // Clear any pending restart
    if (restartRecognitionTimeout) {
      clearTimeout(restartRecognitionTimeout);
      restartRecognitionTimeout = null;
    }
    
    // Always restart in full duplex mode
    if (conversationActive) {
      restartRecognitionTimeout = setTimeout(() => {
        try { 
          recognition.start(); 
          console.log("Restarting recognition");
        } catch (e) {
          console.log("Recognition restart error:", e);
          // Try again if it's a common error
          if (e.message.includes("already started") || e.message.includes("aborted")) {
            setTimeout(() => {
              try { recognition.start(); } catch (e) {}
            }, 200);
          }
        }
      }, 100);
    }
    
    updateUIState();
  };

  recognition.onerror = (e) => {
    console.warn("Recognition error:", e.error);
    isListening = false;
    interruptedByUser = false;
    
    // Clear any pending restart
    if (restartRecognitionTimeout) {
      clearTimeout(restartRecognitionTimeout);
      restartRecognitionTimeout = null;
    }
    
    // Always restart for full duplex (except for certain errors)
    if (conversationActive && e.error !== 'not-allowed' && e.error !== 'service-not-allowed') {
      restartRecognitionTimeout = setTimeout(() => {
        try { 
          recognition.start(); 
        } catch (e) {}
      }, 500);
    }
    
    updateUIState();
  };
}

// Process user query
function processUserQuery(transcript) {
  if (isProcessingUserSpeech) return;
  
  isProcessingUserSpeech = true;
  isThinking = true; // Set thinking state
  console.log("Processing user query:", transcript);
  
  // Send to server
  socket.emit("textMessage", transcript);
  
  // Update UI to thinking state
  isListening = false;
  updateUIState();
  
  // Clear thinking state and restart listening after a short delay
  setTimeout(() => {
    isProcessingUserSpeech = false;
    isThinking = false; // Clear thinking state
    if (conversationActive && !isSpeaking) {
      startListening();
    }
  }, 300);
}

// Start listening
function startListening() {
  if (!recognition) initRecognition();
  
  // Don't start listening if already listening
  if (isListening) {
    console.log("Already listening, not starting again");
    return;
  }
  
  try { 
    recognition.start(); 
    console.log("Started listening");
  } catch (e) {
    console.log("Start listening error:", e);
    // Try again after delay for certain errors
    if (e.message.includes("already started") || e.message.includes("aborted")) {
      setTimeout(() => {
        try { recognition.start(); } catch (e) {}
      }, 200);
    }
  }
}

// Stop listening (only for specific cases)
function stopListening() {
  if (recognition && isListening) {
    try {
      recognition.stop();
      console.log("Stopped listening");
    } catch (e) {
      console.log("Stop listening error:", e);
    }
  }
  isListening = false;
  
  // Clear any pending restart
  if (restartRecognitionTimeout) {
    clearTimeout(restartRecognitionTimeout);
    restartRecognitionTimeout = null;
  }
  
  updateUIState();
}

// Stop AI voice immediately but keep listening
function stopSpeaking() {
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
    console.log("AI speech stopped");
  }
  isSpeaking = false;
  currentUtterance = null;
  
  // IMPORTANT: Don't stop listening when interrupting AI
  // Keep listening for full duplex operation
  if (conversationActive && !isListening && !interruptedByUser) {
    setTimeout(() => {
      startListening();
    }, 100);
  }
  
  updateUIState();
}

// AI speak implementation
function aiSpeak(text) {
  // Clear any ongoing TTS first
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  
  isSpeaking = true;
  isThinking = false; // Clear thinking state when AI starts speaking
  updateUIState();

  // Create new utterance
  currentUtterance = new SpeechSynthesisUtterance(text);

  // Try to find a pleasant voice
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    // Prefer female voices for better user experience
    const femaleVoice = voices.find(v =>
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("samantha") ||
      v.name.toLowerCase().includes("karen") ||
      v.name.toLowerCase().includes("zira") ||
      v.name.toLowerCase().includes("victoria")
    );
    
    if (femaleVoice) {
      currentUtterance.voice = femaleVoice;
      currentUtterance.pitch = 1.1;
      currentUtterance.rate = 1.0;
    }
  }

  currentUtterance.onstart = () => {
    isSpeaking = true;
    updateUIState();
    console.log("AI started speaking");
    
    // Initialize sound detection for interruption (only during responses, not greeting)
    if (!audioContext && !isGreeting) {
      initSoundDetection();
    }
    
    // Keep listening even while AI is speaking (full duplex)
    if (conversationActive && !isListening) {
      setTimeout(() => {
        startListening();
      }, 300);
    }
  };

  currentUtterance.onend = () => {
    isSpeaking = false;
    currentUtterance = null;
    console.log("AI finished speaking");
    
    // Reset greeting flag after greeting is done
    if (isGreeting) {
      isGreeting = false;
      console.log("Greeting finished, interruption now enabled");
    }
    
    if (conversationActive) {
      updateUIState();
      // Restart listening with a slight delay
      setTimeout(() => {
        startListening();
      }, 200);
    }
  };

  currentUtterance.onerror = (e) => {
    console.log("Speech error:", e);
    isSpeaking = false;
    currentUtterance = null;
    
    // Reset greeting flag on error
    if (isGreeting) {
      isGreeting = false;
    }
    
    if (conversationActive) {
      updateUIState();
      // Restart listening on error
      setTimeout(() => {
        startListening();
      }, 200);
    }
  };

  // Speak immediately
  window.speechSynthesis.speak(currentUtterance);
}

// Stop entire conversation
function stopConversation() {
  console.log("Stopping conversation");
  conversationActive = false;
  isInitialized = false;
  isGreeting = false;
  isThinking = false;
  stopSpeaking();
  stopListening();
  lastTranscript = "";
  userSpeechBuffer = [];
  isProcessingUserSpeech = false;
  interruptedByUser = false;
  isUserMakingSound = false;
  
  // Clear any pending restart
  if (restartRecognitionTimeout) {
    clearTimeout(restartRecognitionTimeout);
    restartRecognitionTimeout = null;
  }
  
  // Clean up audio context
  if (audioContext) {
    try {
      if (microphone) microphone.disconnect();
      if (analyser) analyser.disconnect();
      audioContext.close();
      audioContext = null;
    } catch (e) {
      console.log("Audio context cleanup error:", e);
    }
  }
  
  updateUIState();
}

// Start conversation
function startConversation() {
  console.log("Starting conversation - FULL DUPLEX MODE");
  conversationActive = true;
  lastTranscript = "";
  userSpeechBuffer = [];
  isProcessingUserSpeech = false;
  interruptedByUser = false;
  isUserMakingSound = false;
  isThinking = false;
  
  if (!isInitialized) {
    socket.emit("initializeChat", "voice");
    isInitialized = true;
  } else {
    startListening();
  }
  
  updateUIState();
}

// Mic button click
if (micBtn) {
  micBtn.addEventListener("click", () => {
    if (conversationActive) {
      stopConversation();
    } else {
      startConversation();
    }
  });
}

// Socket handlers
socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
  stopConversation();
});

socket.on("chatInitialized", (data) => {
  console.log("Chat initialized:", data);
  updateUIState();
  
  // Speak the greeting (interruption disabled during greeting)
  if (data.greeting) {
    isGreeting = true; // Mark as greeting
    console.log("Starting greeting - interruption disabled");
    setTimeout(() => {
      aiSpeak(data.greeting);
    }, 300);
  } else {
    // Start listening if no greeting
    startListening();
  }
});

socket.on("aiResponse", (data) => {
  if (!conversationActive) return;
  console.log("AI Response:", data.text);
  
  // Speak the response (interruption enabled during responses)
  isGreeting = false; // Mark as response, not greeting
  aiSpeak(data.text);
});

socket.on("error", (err) => {
  console.error("Socket error:", err);
  if (indicator) indicator.textContent = "Error: " + err;
  stopConversation();
});

// Load voices and initialize
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    console.log("Voices loaded:", window.speechSynthesis.getVoices().length);
  };
}

// Initialize UI
updateUIState();

// Handle tab visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Tab is hidden - pause recognition
    if (isListening) {
      stopListening();
      console.log("Paused recognition due to tab visibility");
    }
  } else {
    // Tab is visible - resume if needed
    if (conversationActive && !isSpeaking && !isListening) {
      setTimeout(() => {
        startListening();
        console.log("Resumed recognition after tab visibility change");
      }, 500);
    }
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  stopConversation();
  if (socket) socket.disconnect();
});