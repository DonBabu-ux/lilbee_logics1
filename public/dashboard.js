// dashboard.js - Firebase Client SDK Version (No JWT)
import { auth, rtdb } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { ref, onValue, push, set, update, remove, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

let currentUser = null;

// -------- Auth State Handling --------
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Fetch full user profile from RTDB
    const userRef = ref(rtdb, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        currentUser = snapshot.val();
        updateUI(currentUser);
        initDashboard();
      } else {
        console.warn("User profile not found in database.");
      }
    });
  } else {
    window.location.href = "login.html";
  }
});

// -------- Tabs Handling --------
const tabs = document.querySelectorAll(".menu .tab");
const tabSections = document.querySelectorAll("main .tab");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    tabSections.forEach(sec => {
      sec.classList.remove("active");
      sec.hidden = true;
    });

    const section = document.getElementById(target);
    if (section) {
      section.classList.add("active");
      section.hidden = false;
    }
  });
});

// -------- UI Update Function --------
function updateUI(data) {
  document.getElementById("userEmail").innerText = data.email;
  document.getElementById("userRole").innerText = data.role || "user";
  document.getElementById("updateName").value = data.name || "";
  document.getElementById("updateEmail").value = data.email;
  document.getElementById("updateAvatar").value = data.avatar || "";

  if (data.avatar) {
    const avatarDiv = document.getElementById("userAvatar");
    avatarDiv.style.backgroundImage = `url(${data.avatar})`;
    avatarDiv.style.backgroundSize = "cover";
    avatarDiv.style.backgroundPosition = "center";
  }

  if (data.role === "admin") {
    document.getElementById("adminPortalBtn").hidden = false;
  } else {
    document.getElementById("adminPortalBtn").hidden = true;
  }
}

// -------- Dashboard Features Initialization --------
function initDashboard() {
  loadPosts();
  loadRequests();
  loadChat();
}

// -------- Logout --------
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
});

// -------- Profile Update --------
document.getElementById("updateProfileBtn").addEventListener("click", async () => {
  const updates = {
    name: document.getElementById("updateName").value,
    avatar: document.getElementById("updateAvatar").value
  };

  await update(ref(rtdb, `users/${currentUser.uid}`), updates);
  alert("Profile updated!");
});

// -------- Posts --------
function loadPosts() {
  const postsDiv = document.getElementById("publicFeed");
  const postsRef = ref(rtdb, "posts");

  onValue(postsRef, (snapshot) => {
    postsDiv.innerHTML = "";
    const posts = [];
    snapshot.forEach(child => {
      posts.unshift(child.val());
    });

    posts.forEach(post => {
      const div = document.createElement("div");
      div.className = "feed-post glass-card";
      div.innerHTML = `
                <strong>${post.email}</strong>
                <p>${post.content}</p>
                <small>${new Date(post.timestamp).toLocaleString()}</small>
            `;

      if (post.uid === currentUser.uid || currentUser.role === 'admin') {
        const delBtn = document.createElement("button");
        delBtn.innerText = "Delete";
        delBtn.className = "danger-btn"; // Use a class for consistency
        delBtn.style.background = "#ff4d4d";
        delBtn.style.color = "white";
        delBtn.style.marginTop = "10px";
        delBtn.style.padding = "5px 10px";
        delBtn.style.borderRadius = "5px";
        delBtn.style.border = "none";
        delBtn.style.cursor = "pointer";
        delBtn.onclick = async () => {
          if (confirm("Delete this post?")) {
            await remove(ref(rtdb, `posts/${post.id}`));
          }
        };
        div.appendChild(delBtn);
      }
      postsDiv.appendChild(div);
    });
  });
}

document.getElementById("postBtn").addEventListener("click", async () => {
  const content = document.getElementById("postContent").value.trim();
  if (!content || !currentUser) return;

  if (currentUser.isBanned) {
    alert("You are banned from posting.");
    return;
  }

  const postRef = push(ref(rtdb, "posts"));
  await set(postRef, {
    id: postRef.key,
    uid: currentUser.uid,
    email: currentUser.email,
    content: content,
    timestamp: Date.now()
  });
  document.getElementById("postContent").value = "";
});

// -------- Service Requests --------
function loadRequests() {
  const listDiv = document.getElementById("serviceList");
  const requestsRef = ref(rtdb, "requests");
  const userRequestsQuery = query(requestsRef, orderByChild("uid"), equalTo(currentUser.uid));

  onValue(userRequestsQuery, (snapshot) => {
    listDiv.innerHTML = "";
    snapshot.forEach(child => {
      const req = child.val();
      const div = document.createElement("div");
      div.className = "glass-card";
      div.style.marginBottom = "10px";
      div.innerHTML = `<strong>${req.type}</strong> <p>${req.desc}</p> <small>Status: ${req.status}</small>`;
      listDiv.appendChild(div);
    });
  });
}

document.getElementById("requestServiceBtn").addEventListener("click", async () => {
  const type = document.getElementById("serviceType").value.trim();
  const desc = document.getElementById("serviceDesc").value.trim();
  if (!type || !desc || !currentUser) return;

  const reqRef = push(ref(rtdb, "requests"));
  await set(reqRef, {
    id: reqRef.key,
    uid: currentUser.uid,
    type,
    desc,
    status: "pending",
    timestamp: Date.now()
  });

  document.getElementById("serviceType").value = "";
  document.getElementById("serviceDesc").value = "";
});

// -------- Chat --------
function loadChat() {
  const chatBox = document.getElementById("chatBox");
  const chatRef = ref(rtdb, "chat");

  onValue(chatRef, (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
      const msg = child.val();
      const div = document.createElement("div");
      div.className = msg.uid === currentUser.uid ? "chat-message self" : "chat-message other";
      div.innerHTML = `<strong>${msg.email}</strong>: ${msg.msg}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

document.getElementById("sendMessageBtn").addEventListener("click", async () => {
  const input = document.getElementById("chatMessage");
  const msg = input.value.trim();
  if (!msg || !currentUser) return;

  const chatMsgRef = push(ref(rtdb, "chat"));
  await set(chatMsgRef, {
    id: chatMsgRef.key,
    uid: currentUser.uid,
    email: currentUser.email,
    msg: msg,
    timestamp: Date.now()
  });
  input.value = "";
});
