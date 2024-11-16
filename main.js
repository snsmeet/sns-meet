import './style.css';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBdCyzpyIWdJmTU5t2vyplFHlafuHoFw-o",
  authDomain: "gmeet-e837a.firebaseapp.com",
  projectId: "gmeet-e837a",
  storageBucket: "gmeet-e837a.appspot.com",
  messagingSenderId: "218232317010",
  appId: "1:218232317010:web:9c2c703b8bfab24f5ceb8b",
  measurementId: "G-T5N88G8H0E"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();
const storage = firebase.storage();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let localUsername = "";
let remoteUsername = "";
let callDoc = null;
let isCallActive = true;

const webcamButton = document.getElementById('webcamButton');
const webcamToggleButton = document.getElementById('webcamToggleButton');
const audioToggleButton = document.getElementById('audioToggleButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');
const usernameInput = document.getElementById('usernameInput');
const localUsernameDiv = document.getElementById('localUsername');
const remoteUsernameDiv = document.getElementById('remoteUsername');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('fileInput');
const viewFileButton = document.getElementById('viewFileButton');
const pdfViewerContainer = document.getElementById('pdfViewerContainer');
const pdfViewer = document.getElementById('pdfViewer');
const closePdfButton = document.getElementById('closePdfButton');
const emailInput = document.getElementById('emailInput');
const sendEmailButton = document.getElementById('sendEmailButton');

// Dropdown elements
const resumeViewer = document.getElementById('resumeViewer');
const reportViewer = document.getElementById('reportViewer');
const resumeOptions = document.getElementById('resumeOptions');

usernameInput.onchange = () => {
  localUsername = usernameInput.value;
  localUsernameDiv.textContent = localUsername;
};

// Toggle dropdown visibility on button click
document.querySelector('.dropdown-btn').onclick = () => {
  document.querySelector('.dropdown-content').classList.toggle('show');
};

// Show options for Resume Viewer, hide for Report Viewer
resumeViewer.onclick = () => {
  resumeOptions.classList.remove('hidden');
  fileInput.value = ""; // Clear any previously selected file
  viewFileButton.disabled = true; // Reset view button
};

reportViewer.onclick = () => {
  resumeOptions.classList.add('hidden');
  alert("Report Viewer is currently a dummy option.");
};

// Webcam and call setup
webcamButton.onclick = async () => {
  if (!localUsername) {
    alert("Please enter a username before starting the webcam.");
    return;
  }

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();

  // Add video and audio tracks to peer connection for remote user
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Assign local video stream
  webcamVideo.srcObject = localStream;

  // Listen for remote stream and assign it only to remote video
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  remoteVideo.srcObject = remoteStream;



  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
  webcamVideo.muted = true;  // Mute local video to avoid self-hearing
  webcamToggleButton.disabled = false;
  audioToggleButton.disabled = false;
};

// Toggle webcam video
webcamToggleButton.onclick = () => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  webcamToggleButton.textContent = videoTrack.enabled ? "Turn Webcam Off" : "Turn Webcam On";
};

// Toggle audio
audioToggleButton.onclick = () => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  audioToggleButton.textContent = audioTrack.enabled ? "Turn Audio Off" : "Turn Audio On";
};

// Call setup
callButton.onclick = async () => {
  callDoc = firestore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates');
  const answerCandidates = callDoc.collection('answerCandidates');
  const chatMessagesCollection = callDoc.collection('chatMessages');

  callInput.value = callDoc.id;

  pc.onicecandidate = (event) => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  };

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
    username: localUsername,
    hangup: false,
  };

  await callDoc.set({ offer });

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
      remoteUsername = data.answer.username;
      remoteUsernameDiv.textContent = remoteUsername;
    }

    if (data?.offer?.hangup && isCallActive) {
      handleRemoteHangup();
    }
  });

  answerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

  hangupButton.disabled = false;
  sendButton.disabled = false;
  viewFileButton.disabled = false;

  // Real-time chat listener
  chatMessagesCollection.orderBy('timestamp').onSnapshot((snapshot) => {
    if (isCallActive) {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const messageData = change.doc.data();
          if (messageData.fileUrl) {
            displayFileLink(messageData.username, messageData.fileUrl);
          } else {
            displayMessage(messageData.username, messageData.message);
          }
        }
      });
    }
  });

  // Enable email input and send button after code creation
  sendEmailButton.disabled = false;
};

// Send chat message
sendButton.onclick = async () => {
  const message = chatInput.value.trim();
  if (message === "") return;

  const chatMessagesCollection = callDoc.collection('chatMessages');

  await chatMessagesCollection.add({
    username: localUsername,
    message: message,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
  });

  chatInput.value = ""; // Clear the chat input field
};

// File selection for PDF viewing
fileInput.onchange = () => {
  const file = fileInput.files[0];
  viewFileButton.disabled = !(file && file.type === "application/pdf");
};

// Upload and view PDF (New Functionality)
viewFileButton.onclick = async () => {
  const file = fileInput.files[0];
  if (file && file.type === "application/pdf") {
    const fileURL = URL.createObjectURL(file);
    openPdfViewer(fileURL);
  } else {
    alert("Please select a PDF file.");
  }
};

// Email sending functionality
sendEmailButton.onclick = async () => {
  const email = emailInput.value;
  const code = callInput.value;

  if (!email) {
    alert("Please enter an email address.");
    return;
  }

  try {
    const response = await fetch('/api/send-email', {  // Updated endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });

    if (response.ok) {
      alert("Email sent successfully!");
    } else {
      alert("Failed to send email.");
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

// Handling when the call ends
answerButton.onclick = async () => {
  const callId = callInput.value;
  callDoc = firestore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');
  const chatMessagesCollection = callDoc.collection('chatMessages');

  pc.onicecandidate = (event) => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  };

  const callData = (await callDoc.get()).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
  remoteUsername = callData.offer.username;
  remoteUsernameDiv.textContent = remoteUsername;

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
    username: localUsername,
    hangup: false,
  };

  await callDoc.update({ answer });

  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });

  hangupButton.disabled = false;
  sendButton.disabled = false;
  viewFileButton.disabled = false;

  chatMessagesCollection.orderBy('timestamp').onSnapshot((snapshot) => {
    if (isCallActive) {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const messageData = change.doc.data();
          if (messageData.fileUrl) {
            displayFileLink(messageData.username, messageData.fileUrl);
          } else {
            displayMessage(messageData.username, messageData.message);
          }
        }
      });
    }
  });

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (data?.offer?.hangup && isCallActive) {
      handleRemoteHangup();
    }
  });
};

function displayMessage(username, message) {
  const messageElement = document.createElement('div');
  messageElement.className = "message";
  messageElement.textContent = `${username}: ${message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayFileLink(username, fileUrl) {
  const messageElement = document.createElement('div');
  messageElement.className = "message";
  const linkElement = document.createElement('a');
  linkElement.href = "#";
  linkElement.textContent = `${username} sent a PDF`;
  linkElement.onclick = (e) => {
    e.preventDefault();
    openPdfViewer(fileUrl);
  };
  messageElement.appendChild(linkElement);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function openPdfViewer(url) {
  pdfViewer.src = url;
  pdfViewerContainer.style.display = "block";
}

closePdfButton.onclick = () => {
  pdfViewerContainer.style.display = "none";
  pdfViewer.src = "";
};

function blackoutScreen(videoElement) {
  videoElement.srcObject = null;
  videoElement.style.backgroundColor = "black";
}

function disableAllFeatures() {
  webcamButton.disabled = true;
  webcamToggleButton.disabled = true;
  audioToggleButton.disabled = true;
  callButton.disabled = true;
  answerButton.disabled = true;
  hangupButton.disabled = true;
  sendButton.disabled = true;
  viewFileButton.disabled = true;
}

function handleRemoteHangup() {
  blackoutScreen(remoteVideo);
  remoteUsernameDiv.textContent = ""; // Hide the remote username
}

hangupButton.onclick = async () => {
  if (callDoc) {
    await callDoc.update({
      "offer.hangup": true,
    });
  }
  blackoutScreen(webcamVideo);
  pc.close();
  disableAllFeatures();
  isCallActive = false;
};
