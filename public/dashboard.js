// dashboard.js
import { auth, db } from "./firebase-config.js";
import { 
  doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, query, where, deleteDoc 
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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

// -------- Auth State --------
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Fetch user profile from Firestore
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    alert("User profile not found!");
    return;
  }

  let currentUser = userSnap.data();
  currentUser.uid = user.uid;

  // -------- UI Update Function --------
  const updateUI = (data) => {
    document.getElementById("userEmail").innerText = data.email;
    document.getElementById("userRole").innerText = data.role || "user";
    document.getElementById("updateName").value = data.name || "";
    document.getElementById("updateEmail").value = data.email;
    document.getElementById("updateAvatar").value = data.avatar || "";

    if (data.avatar) {
      document.getElementById("userAvatar").style.backgroundImage = `url(${data.avatar})`;
      document.getElementById("userAvatar").style.backgroundSize = "cover";
    }

    if (data.role === "admin") {
      document.getElementById("adminTabBtn").hidden = false;
      setupAdminPanel();
    } else {
      document.getElementById("adminTabBtn").hidden = true;
    }
  };

  updateUI(currentUser);

  // -------- Logout --------
  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await auth.signOut();
    window.location.href = "login.html";
  });

  // -------- Profile Update --------
  document.getElementById("updateProfileBtn").addEventListener("click", async () => {
    const updatedData = {
      name: document.getElementById("updateName").value,
      email: document.getElementById("updateEmail").value,
      avatar: document.getElementById("updateAvatar").value
    };
    await updateDoc(userRef, updatedData);
    alert("Profile updated!");
  });

  // -------- Posts --------
  const loadPosts = async () => {
    const postsDiv = document.getElementById("postsFeed");
    postsDiv.innerHTML = "";
    const postsCol = collection(db, "posts");
    const postsSnapshot = await getDocs(postsCol);
    postsSnapshot.forEach(docSnap => {
      const post = docSnap.data();
      const div = document.createElement("div");
      div.className = "feed-post glass-card";
      div.innerHTML = `
        <strong>${post.email}</strong>
        <p>${post.content}</p>
        <small>${new Date(post.timestamp).toLocaleString()}</small>
      `;
      if (post.uid === currentUser.uid) {
        const delBtn = document.createElement("button");
        delBtn.innerText = "Delete";
        delBtn.onclick = async () => {
          if (confirm("Delete this post?")) {
            await deleteDoc(doc(db, "posts", docSnap.id));
            loadPosts();
          }
        };
        div.appendChild(delBtn);
      }
      postsDiv.appendChild(div);
    });
  };

  document.getElementById("postBtn").addEventListener("click", async () => {
    const content = document.getElementById("postContent").value.trim();
    if (!content) return;
    await addDoc(collection(db, "posts"), {
      uid: currentUser.uid,
      email: currentUser.email,
      content,
      timestamp: Date.now()
    });
    document.getElementById("postContent").value = "";
    loadPosts();
  });

  loadPosts();

  // -------- Service Requests --------
  const loadRequests = async () => {
    const listDiv = document.getElementById("serviceList");
    listDiv.innerHTML = "";
    const q = query(collection(db, "services"), where("uid", "==", currentUser.uid));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      const req = docSnap.data();
      const div = document.createElement("div");
      div.className = "glass-card";
      div.innerHTML = `<strong>${req.type}</strong> <p>${req.desc}</p> <small>Status: ${req.status}</small>`;
      listDiv.appendChild(div);
    });
  };

  document.getElementById("requestServiceBtn").addEventListener("click", async () => {
    const type = document.getElementById("serviceType").value.trim();
    const desc = document.getElementById("serviceDesc").value.trim();
    if (!type || !desc) return;
    await addDoc(collection(db, "services"), {
      uid: currentUser.uid,
      type,
      desc,
      status: "pending",
      timestamp: Date.now()
    });
    document.getElementById("serviceType").value = "";
    document.getElementById("serviceDesc").value = "";
    loadRequests();
  });

  loadRequests();

  // -------- Chat --------
  const loadChat = async () => {
    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML = "";
    const chatCol = collection(db, "chat");
    const chatSnapshot = await getDocs(chatCol);
    chatSnapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const div = document.createElement("div");
      div.className = msg.uid === currentUser.uid ? "chat-message self" : "chat-message other";
      div.innerHTML = `<strong>${msg.email}</strong>: ${msg.msg}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  document.getElementById("sendMessageBtn").addEventListener("click", async () => {
    const input = document.getElementById("chatMessage");
    const msg = input.value.trim();
    if (!msg) return;
    await addDoc(collection(db, "chat"), {
      uid: currentUser.uid,
      email: currentUser.email,
      msg,
      timestamp: Date.now()
    });
    input.value = "";
    loadChat();
  });

  loadChat();

  // -------- Admin Panel --------
  function setupAdminPanel() {
    const loadUsers = async () => {
      const usersCol = collection(db, "users");
      const snapshot = await getDocs(usersCol);
      const tbody = document.getElementById("userTableBody");
      tbody.innerHTML = "";
      snapshot.forEach(docSnap => {
        const u = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.email}</td>
          <td>${u.role || "user"}</td>
          <td>
            <button onclick="updateRole('${docSnap.id}', 'admin')">Make Admin</button>
            <button onclick="updateRole('${docSnap.id}', 'user')">Make User</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    };

    window.updateRole = async (uid, role) => {
      await updateDoc(doc(db, "users", uid), { role });
      alert("User role updated!");
      loadUsers();
    };

    loadUsers();
  }
});
