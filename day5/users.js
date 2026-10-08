const USERS_URL = "https://jsonplaceholder.typicode.com/users";

const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusText = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

let users = [];

function renderUsers(list) {
  usersList.textContent = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    usersList.appendChild(li);
    return;
  }

  list.forEach((user) => {
    const li = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const details = document.createElement("div");
    details.textContent = `${user.email} · ${user.address.city} · ${user.company.name}`;

    li.appendChild(name);
    li.appendChild(details);
    usersList.appendChild(li);
  });
}

function applyFilter() {
  if (users.length === 0) return;

  const text = filterInput.value.trim().toLowerCase();

  const matches = users.filter((user) =>
    user.name.toLowerCase().includes(text)
  );

  renderUsers(matches);
}

async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadBtn.disabled = true;

  try {
    const response = await fetch(USERS_URL);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }
    users = await response.json();
    statusText.textContent = `Loaded ${users.length} users.`;
    applyFilter();
  } catch (error) {
    statusText.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadBtn.disabled = false;
  }
}

loadBtn.addEventListener("click", loadUsers);
filterInput.addEventListener("input", applyFilter);