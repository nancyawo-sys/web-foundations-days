const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadBtn = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusText = document.querySelector("#status");
const list = document.querySelector("#users-list");

let users = [];

async function loadUsers() {
  statusText.textContent = "Loading users...";
  loadBtn.disabled = true;

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    users = await response.json();
    renderUsers(users);
    statusText.textContent = `Loaded ${users.length} users.`;
  } catch (error) {
    statusText.textContent = "Could not load users. Please try again.";
    console.error(error);
  } finally {
    loadBtn.disabled = false;
  }
}

function renderUsers(usersToShow) {
  list.innerHTML = "";

  if (usersToShow.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No users match your filter.";
    list.appendChild(empty);
    return;
  }

  usersToShow.forEach((user) => {
    const li = document.createElement("li");
    li.textContent = `${user.name} - ${user.email} - ${user.address.city} - ${user.company.name}`;
    list.appendChild(li);
  });
}

loadBtn.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const search = filterInput.value.trim().toLowerCase();
  const matches = users.filter((user) =>
    user.name.toLowerCase().includes(search)
  );
  renderUsers(matches);
});
