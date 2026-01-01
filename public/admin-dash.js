// admin-dash.js - Dedicated Admin Control Center
import { auth, rtdb } from "./firebase-config.js";
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

let currentUser = null;

// -------- Auth & Security Check --------
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userRef = ref(rtdb, `users/${user.uid}`);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                currentUser = snapshot.val();
                if (currentUser.role !== 'admin') {
                    alert("Unauthorized access. Redirecting to User Portal.");
                    window.location.href = "dashboard.html";
                    return;
                }
                updateUI(currentUser);
                initAdmin();
            } else {
                window.location.href = "login.html";
            }
        }, { onlyOnce: true });
    } else {
        window.location.href = "login.html";
    }
});

function updateUI(data) {
    document.getElementById("userEmail").innerText = data.email;
    if (data.avatar) {
        const avatarDiv = document.getElementById("userAvatar");
        avatarDiv.style.backgroundImage = `url(${data.avatar})`;
        avatarDiv.style.backgroundSize = "cover";
    }
}

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
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${u.email}</td>
                <td><span class="badge ${u.role}">${u.role}</span></td>
                <td><span class="status ${u.isBanned ? 'offline' : 'online'}">${u.isBanned ? 'Banned' : 'Active'}</span></td>
                <td class="actions">
                    <button class="small-btn" onclick="updateRole('${u.uid}', '${u.role === 'admin' ? 'user' : 'admin'}')">
                        ${u.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                    <button class="small-btn danger" onclick="toggleBan('${u.uid}', ${!u.isBanned})">
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

document.getElementById("adminCreateUserBtn").addEventListener("click", async () => {
    const email = document.getElementById("adminNewUserEmail").value.trim();
    const pass = document.getElementById("adminNewUserPass").value.trim();
    if (!email || !pass) return;

    try {
        // Note: Creating a user in a separate window/tab might sign out the current admin
        // This is a limitation of the client SDK. For a real admin "Create User" feature, 
        // you'd typically use a Cloud Function or Backend Admin SDK.
        // For now, we'll alert the user.
        alert("Client-side user creation is disabled to prevent signing you out. Use Signup page for new accounts.");
    } catch (e) {
        alert(e.message);
    }
});

// -------- Service Requests --------
function loadServices() {
    const listDiv = document.getElementById("adminServiceList");
    const requestsRef = ref(rtdb, "requests");

    onValue(requestsRef, (snapshot) => {
        listDiv.innerHTML = "";
        snapshot.forEach(child => {
            const req = child.val();
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
                            <button onclick="updateStatus('${req.id}', 'Approved')" class="small-btn">Approve</button>
                            <button onclick="updateStatus('${req.id}', 'Completed')" class="small-btn">Complete</button>
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
            const div = document.createElement("div");
            div.className = "mod-item glass-card";
            div.innerHTML = `
                <p><strong>${p.email}</strong>: ${p.content}</p>
                <button class="danger" onclick="adminDelete('posts', '${p.id}')">Delete Post</button>
            `;
            postList.appendChild(div);
        });
    });

    const chatList = document.getElementById("adminChatList");
    onValue(ref(rtdb, "chat"), (snapshot) => {
        chatList.innerHTML = "";
        snapshot.forEach(child => {
            const c = child.val();
            const div = document.createElement("div");
            div.className = "mod-item glass-card";
            div.innerHTML = `
                <p><strong>${c.email}</strong>: ${c.msg}</p>
                <button class="danger" onclick="adminDelete('chat', '${c.id}')">Delete Message</button>
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