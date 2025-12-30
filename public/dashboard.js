import { localAuth } from "./local-auth.js";
import { localDB } from "./local-db.js";

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

localAuth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const users = await localDB.getUsers();
    const freshUser = users.find(u => u.uid === user.uid);
    if (freshUser) {
      if (JSON.stringify(freshUser) !== JSON.stringify(user)) {
        user = freshUser;
        localAuth.saveSession(user);
      }
    }
  } catch (err) {
    console.warn("Could not sync session:", err);
  }

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

    if (data.role === 'admin') {
      document.getElementById("adminTabBtn").hidden = false;
      setupAdminListeners();
    } else {
      document.getElementById("adminTabBtn").hidden = true;
    }
  };

  updateUI(user);

  window.addEventListener("localDBUpdate:users", () => {
    const updatedUser = localAuth.getCurrentUser();
    if (updatedUser) updateUI(updatedUser);
  });

  const toggleBtn = document.getElementById("toggleUpdateBtn");
  const updateArea = document.getElementById("profileUpdateArea");
  if (toggleBtn && updateArea) {
    toggleBtn.onclick = () => {
      updateArea.hidden = !updateArea.hidden;
      toggleBtn.innerText = updateArea.hidden ? "Edit Profile" : "Cancel";
    };
  }

  setupPresence(user.uid);
  setupFeed(user);
  setupServices(user.uid);
  setupChat(user.uid);
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localAuth.logout();
  window.location.href = "login.html";
});

document.getElementById("updateProfileBtn").addEventListener("click", async () => {
  const user = localAuth.getCurrentUser();
  const updatedData = {
    ...user,
    name: document.getElementById("updateName").value,
    email: document.getElementById("updateEmail").value,
    avatar: document.getElementById("updateAvatar").value
  };

  const updated = await localDB.saveUser(updatedData);
  localAuth.saveSession(updated);
  alert("Profile updated!");
  document.getElementById("profileUpdateArea").hidden = true;
  document.getElementById("toggleUpdateBtn").innerText = "Edit Profile";
});

function setupPresence(uid) {
  const statusSpan = document.getElementById("userStatus");
  statusSpan.innerText = "Online";
}

function setupFeed(currentUser) {
  const publicFeedDiv = document.getElementById("publicFeed");
  const myPostsDiv = document.getElementById("myPostsFeed");

  const feedTabs = document.querySelectorAll(".feed-tab");
  feedTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      feedTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.feed;
      publicFeedDiv.hidden = target !== "public";
      myPostsDiv.hidden = target === "public";
    });
  });

  const renderFeed = async () => {
    const posts = await localDB.getPosts();
    publicFeedDiv.innerHTML = "";
    myPostsDiv.innerHTML = "";

    posts.forEach(post => {
      const isMine = post.uid === currentUser.uid;
      const div = document.createElement("div");
      div.className = "feed-post glass-card";
      if (isMine) div.classList.add("my-post");

      div.innerHTML = `
        ${isMine ? `<div class="post-actions"><button class="delete-btn-sm" onclick="window.deleteMyPost('${post.id}')">Delete</button></div>` : ""}
        <strong>${post.email}</strong> ${isMine ? '<span class="badge" style="font-size:9px">You</span>' : ''}
        <p>${post.content}</p>
        <small style="color:var(--muted)">${new Date(post.timestamp).toLocaleString()}</small>
      `;

      if (isMine) myPostsDiv.appendChild(div);
      else publicFeedDiv.appendChild(div);
    });

    if (publicFeedDiv.innerHTML === "") publicFeedDiv.innerHTML = "<p>No posts from others yet.</p>";
    if (myPostsDiv.innerHTML === "") myPostsDiv.innerHTML = "<p>You haven't posted anything yet.</p>";
  };

  renderFeed();
  window.addEventListener("localDBUpdate:posts", renderFeed);

  document.getElementById("postBtn").onclick = async () => {
    const content = document.getElementById("postContent").value.trim();
    if (!content) return;
    try {
      await localDB.addPost({
        uid: currentUser.uid,
        email: currentUser.email,
        content
      });
      document.getElementById("postContent").value = "";
      alert("Post shared!");
    } catch (e) {
      alert(e.message);
    }
  };

  window.deleteMyPost = async (postId) => {
    if (confirm("Delete your post?")) {
      await localDB.deletePost(postId);
      alert("Post removed.");
    }
  };
}

function setupServices(uid) {
  const listDiv = document.getElementById("serviceList");

  const renderRequests = async () => {
    const requests = await localDB.getRequests(uid);
    listDiv.innerHTML = "";
    requests.forEach(req => {
      const div = document.createElement("div");
      div.className = "glass-card";
      div.style.marginBottom = "10px";
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <strong>${req.type}</strong>
          <span class="status-badge status-${req.status}">${req.status}</span>
        </div>
        <p>${req.desc}</p>
        <small style="color:var(--muted)">Submitted: ${new Date(req.timestamp).toLocaleDateString()}</small>
      `;
      listDiv.appendChild(div);
    });
  };

  renderRequests();
  window.addEventListener("localDBUpdate:requests", renderRequests);

  document.getElementById("requestServiceBtn").onclick = async () => {
    const type = document.getElementById("serviceType").value.trim();
    const desc = document.getElementById("serviceDesc").value.trim();
    if (!type || !desc) return;
    await localDB.addRequest({
      uid,
      type,
      desc
    });
    document.getElementById("serviceType").value = "";
    document.getElementById("serviceDesc").value = "";
    alert("Service request submitted!");
  };
}

function setupChat(uid) {
  const chatBox = document.getElementById("chatBox");

  const renderChat = async () => {
    const chat = await localDB.getChat();
    chatBox.innerHTML = "";

    // Process messages
    chat.forEach(msg => {
      const isMe = msg.uid === uid;
      const div = document.createElement("div");
      div.className = isMe ? "chat-message self" : "chat-message other";

      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const sender = isMe ? "You" : (msg.email.split('@')[0]); // Just show username part

      div.innerHTML = `
        <div class="chat-meta">
          <span>${sender}</span>
          <span class="chat-time">${time}</span>
        </div>
        <div class="message-content">${msg.msg}</div>
      `;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  renderChat();
  window.addEventListener("localDBUpdate:chat", renderChat);

  document.getElementById("sendMessageBtn").innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
  `;

  const sendMsg = async () => {
    const input = document.getElementById("chatMessage");
    const msg = input.value.trim();
    if (!msg) return;

    const user = localAuth.getCurrentUser();
    await localDB.addChatMessage({
      uid,
      email: user.email,
      msg
    });
    input.value = "";
  };

  document.getElementById("sendMessageBtn").onclick = sendMsg;
  document.getElementById("chatMessage").onkeydown = (e) => {
    if (e.key === 'Enter') sendMsg();
  };
}

let adminListenersLoaded = false;
function setupAdminListeners() {
  if (adminListenersLoaded) return;
  adminListenersLoaded = true;

  const subTabs = document.querySelectorAll(".sub-tab");
  const subSections = document.querySelectorAll(".admin-content");

  subTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.sub;
      subTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      subSections.forEach(sec => {
        sec.hidden = true;
        if (sec.id === target) sec.hidden = false;
      });
    });
  });

  document.getElementById("adminCreateUserBtn").onclick = async () => {
    const email = document.getElementById("adminNewUserEmail").value.trim();
    const password = document.getElementById("adminNewUserPass").value.trim();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      await localDB.saveUser({ email, password });
      alert(`User ${email} created!`);
      document.getElementById("adminNewUserEmail").value = "";
      document.getElementById("adminNewUserPass").value = "";
    } catch (e) {
      alert(e.message);
    }
  };

  const renderAdmin = async () => {
    const users = await localDB.getUsers();
    const requests = await localDB.getRequests();
    const posts = await localDB.getPosts();
    const chat = await localDB.getChat();

    const tableBody = document.getElementById("userTableBody");
    tableBody.innerHTML = "";
    users.forEach(user => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${user.email}</td>
        <td><span class="badge">${user.role || 'user'}</span></td>
        <td><span class="status-badge ${user.isBanned ? 'status-completed' : 'status-active'}" style="background:${user.isBanned ? '#ff4444' : '#44ff44'}">${user.isBanned ? 'Banned' : 'Active'}</span></td>
        <td>
          <button class="admin-action-btn promote" onclick="window.updateUserRole('${user.uid}', 'admin')">Make Admin</button>
          <button class="admin-action-btn demote" onclick="window.updateUserRole('${user.uid}', 'user')">Make User</button>
          <button class="admin-action-btn ${user.isBanned ? 'promote' : 'danger'}" style="background:${user.isBanned ? '#2ecc71' : '#e74c3c'}" onclick="window.toggleUserBan('${user.uid}')">
            ${user.isBanned ? 'Unban' : 'Ban'}
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    const adminServiceList = document.getElementById("adminServiceList");
    adminServiceList.innerHTML = "";
    requests.forEach(req => {
      const div = document.createElement("div");
      div.className = "glass-card";
      div.style.marginBottom = "10px";
      div.innerHTML = `
        <strong>${req.type}</strong> (${req.uid})
        <p>${req.desc}</p>
        <div style="display:flex; gap:10px; align-items:center;">
          <span class="status-badge status-${req.status}">${req.status}</span>
          <select class="status-select" onchange="window.updateRequestStatus('${req.id}', this.value)">
            <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="active" ${req.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="completed" ${req.status === 'completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>
      `;
      adminServiceList.appendChild(div);
    });

    const adminPostList = document.getElementById("adminPostList");
    adminPostList.innerHTML = "";
    posts.forEach(post => {
      const div = document.createElement("div");
      div.className = "mod-item";
      div.innerHTML = `<strong>${post.email}</strong><p>${post.content}</p>
        <button class="delete-btn" onclick="window.deleteContent('posts', '${post.id}')">Delete Post</button>`;
      adminPostList.appendChild(div);
    });

    const adminChatList = document.getElementById("adminChatList");
    adminChatList.innerHTML = "";
    chat.forEach(msg => {
      const div = document.createElement("div");
      div.className = "mod-item";
      div.innerHTML = `<strong>${msg.email}</strong><p>${msg.msg}</p>
        <button class="delete-btn" onclick="window.deleteContent('chat', '${msg.id}')">Delete Message</button>`;
      adminChatList.appendChild(div);
    });
  };

  renderAdmin();
  window.addEventListener("localDBUpdate:users", renderAdmin);
  window.addEventListener("localDBUpdate:posts", renderAdmin);
  window.addEventListener("localDBUpdate:requests", renderAdmin);
  window.addEventListener("localDBUpdate:chat", renderAdmin);
}

window.updateUserRole = async (uid, newRole) => {
  await localDB.saveUser({ uid, role: newRole });
  alert("User role updated!");
};

window.updateRequestStatus = async (reqId, newStatus) => {
  await localDB.updateRequest(reqId, { status: newStatus });
  alert("Status updated!");
};

window.toggleUserBan = async (uid) => {
  await localDB.toggleUserBan(uid);
  alert("User status updated!");
};

window.deleteContent = async (type, id) => {
  if (!confirm("Delete this permanently?")) return;
  if (type === "posts") await localDB.deletePost(id);
  else await localDB.deleteChat(id);
  alert("Deleted!");
};
