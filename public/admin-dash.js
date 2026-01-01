// admin-dash.js - Dedicated Admin Control Center
import { auth, rtdb } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

// -------- Hardcoded Admin Seed --------
const HARDCODED_ADMIN = {
    uid: "admin123",
    email: "admin@mywebsite.com",
    role: "admin",
    avatar: "https://i.pravatar.cc/100",
    isBanned: false
};

let currentUser = null;

// -------- Auth & Security Check --------
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userRef = ref(rtdb, `users/${user.uid}`);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                currentUser = snapshot.val();
            } else if (user.email === HARDCODED_ADMIN.email) {
                // First-time admin login: inject hardcoded credentials
                currentUser = HARDCODED_ADMIN;
                set(ref(rtdb, `users/${HARDCODED_ADMIN.uid}`), HARDCODED_ADMIN);
            } else {
                window.location.href = "login.html";
                return;
            }

            if (currentUser.role !== 'admin') {
                alert("Unauthorized access. Redirecting to User Portal.");
                window.location.href = "dashboard.html";
                return;
            }

            updateUI(currentUser);
            initAdmin();
        }, { onlyOnce: true });
    } else {
        window.location.href = "login.html";
    }
});

// -------- UI Update --------
function updateUI(data) {
    document.getElementById("userEmail").innerText = data.email;
    if (data.avatar) {
        const avatarDiv = document.getElementById("userAvatar");
        avatarDiv.style.backgroundImage = `url(${data.avatar})`;
        avatarDiv.style.backgroundSize = "cover";
    }
}

// -------- Admin Initialization --------
function initAdmin() {
    loadUsers();
    loadServices();
    loadModeration();
}

// -------- Tabs --------
const tabs = document.querySelectorAll(".menu .tab");
const sections = document.querySelectorAll("main .tab");

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        if (!target) return;

        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        sections.forEach(sec => {
            sec.classList.remove("active");
            sec.hidden = true;
        });

        const targetSec = document.getElementById(target);
        if (targetSec) {
            targetSec.classList.add("active");
            targetSec.hidden = false;
        }
    });
});

// -------- User Management --------
function loadUsers() {
    const tbody = document.getElementById("userTableBody");
    const usersRef = ref(rtdb, "users");

    onValue(usersRef, (snapshot) => {
        tbody.innerHTML = "";
        snapshot.forEach(child => {
            const u = child.val();
            const uid = child.key; // Correct UID
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${u.email}</td>
                <td><span class="badge ${u.role}">${u.role}</span></td>
                <td><span class="status ${u.isBanned ? 'offline' : 'online'}">${u.isBanned ? 'Banned' : 'Active'}</span></td>
                <td class="actions">
                    <button class="small-btn" onclick="updateRole('${uid}', '${u.role === 'admin' ? 'user' : 'admin'}')">
                        ${u.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button class="small-btn danger" onclick="toggleBan('${uid}', ${!u.isBanned})">
                        ${u.isBanned ? 'Unban' : 'Ban'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

window.updateRole = async (uid, role) => {
    await update(ref(rtdb, `users/${uid}`), { role });
};

window.toggleBan = async (uid, isBanned) => {
    await update(ref(rtdb, `users/${uid}`), { isBanned });
};

// -------- User Creation Button --------
document.getElementById("adminCreateUserBtn").addEventListener("click", () => {
    alert("Client-side user creation is disabled to prevent signing you out. Use Signup page for new accounts.");
});

// -------- Service Requests --------
function loadServices() {
    const listDiv = document.getElementById("adminServiceList");
    const requestsRef = ref(rtdb, "requests");

    onValue(requestsRef, (snapshot) => {
        listDiv.innerHTML = "";
        snapshot.forEach(child => {
            const req = child.val();
            const requestId = child.key; // Use correct key
            const div = document.createElement("div");
            div.className = "glass-card";
            div.style.marginBottom = "15px";
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div>
                        <strong>${req.type}</strong>
                        <p>${req.desc}</p>
                        <small>Customer: ${req.uid}</small>
                    </div>
                    <div style="text-align:right;">
                        <span class="badge ${req.status}">${req.status}</span>
                        <div style="margin-top:10px; display:flex; gap:5px;">
                            <button onclick="updateStatus('${requestId}', 'Approved')" class="small-btn">Approve</button>
                            <button onclick="updateStatus('${requestId}', 'Completed')" class="small-btn">Complete</button>
                        </div>
                    </div>
                </div>
            `;
            listDiv.appendChild(div);
        });
    });
}

window.updateStatus = async (id, status) => {
    await update(ref(rtdb, `requests/${id}`), { status });
};

// -------- Moderation --------
function loadModeration() {
    const postList = document.getElementById("adminPostList");
    onValue(ref(rtdb, "posts"), (snapshot) => {
        postList.innerHTML = "";
        snapshot.forEach(child => {
            const p = child.val();
            const postId = child.key;
            const div = document.createElement("div");
            div.className = "mod-item glass-card";
            div.innerHTML = `
                <p><strong>${p.email}</strong>: ${p.content}</p>
                <button class="danger" onclick="adminDelete('posts', '${postId}')">Delete Post</button>
            `;
            postList.appendChild(div);
        });
    });

    const chatList = document.getElementById("adminChatList");
    onValue(ref(rtdb, "chat"), (snapshot) => {
        chatList.innerHTML = "";
        snapshot.forEach(child => {
            const c = child.val();
            const chatId = child.key;
            const div = document.createElement("div");
            div.className = "mod-item glass-card";
            div.innerHTML = `
                <p><strong>${c.email}</strong>: ${c.msg}</p>
                <button class="danger" onclick="adminDelete('chat', '${chatId}')">Delete Message</button>
            `;
            chatList.appendChild(div);
        });
    });
}

window.adminDelete = async (path, id) => {
    if (confirm("Permanently delete this?")) {
        await remove(ref(rtdb, `${path}/${id}`));
    }
};

// -------- Logout --------
document.getElementById("logoutBtn").addEventListener("click", () => {
    signOut(auth).then(() => window.location.href = "login.html");
});