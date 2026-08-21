const API = "/api";
const TAMIL_NADU_LOCALITIES = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar"
];
let category = "All";
let selectedLocation = "All";
let serviceCatalog = [];
let districtCatalog = [];
let currentTicket = null;
let adminKey = sessionStorage.getItem("queuelessAdminKey") || "";
let pendingServiceId = "";

const SERVICE_DETAIL_FIELDS = {
  bank: [
    {
      id: "bankName",
      label: "Choose bank",
      type: "select",
      options: [
        "State Bank of India",
        "HDFC Bank",
        "ICICI Bank",
        "Axis Bank",
        "Canara Bank",
        "Indian Bank",
        "Bank of Baroda",
        "Punjab National Bank",
        "Union Bank of India",
        "Indian Overseas Bank",
        "Tamilnad Mercantile Bank",
        "Kotak Mahindra Bank"
      ]
    },
    {
      id: "bankServiceCategory",
      label: "Banking service category",
      type: "select",
      options: [
        "Account opening",
        "Cash deposit",
        "Cash withdrawal",
        "Cheque services",
        "Money transfer",
        "Loan enquiry",
        "Credit or debit card",
        "Passbook update",
        "ATM services",
        "Fixed deposit",
        "Online banking",
        "Customer support"
      ]
    },
    { id: "accountNumber", label: "Account number", type: "text", placeholder: "Enter your account number" },
    { id: "bankEnquiryReason", label: "Reason for bank enquiry", type: "text", placeholder: "Enter the reason for your enquiry" }
  ],
  "college-office": [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Admissions", "Certificates", "Fees and payments", "Examinations", "Student records", "General enquiry"] },
    { id: "collegeIdCard", label: "College ID card", type: "text", placeholder: "Enter your college ID card number" },
    { id: "collegeAttachment", label: "Attach file", type: "file", accept: ".pdf,.jpg,.jpeg,.png" },
    { id: "rollNumber", label: "Roll number", type: "text", placeholder: "Enter your roll number" },
    { id: "officeVisitReason", label: "Reason for office visit", type: "text", placeholder: "Enter the reason for your visit" }
  ],
  hospital: [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Outpatient consultation", "Emergency", "Laboratory", "Radiology", "Pharmacy", "Billing and insurance"] },
    { id: "patientId", label: "Patient ID", type: "text", placeholder: "Enter the patient ID" },
    { id: "appointmentInfo", label: "Appointment information", type: "text", placeholder: "Enter appointment date or reference" },
    { id: "attachment", label: "Attach file", type: "file", accept: ".pdf,.jpg,.jpeg,.png" }
  ],
  pharmacy: [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Prescription medicines", "Over-the-counter medicines", "Prescription refill", "Health products", "Medicine availability", "Billing"] },
    { id: "pharmacyAttachment", label: "Prescription", type: "file", accept: ".pdf,.jpg,.jpeg,.png" }
  ],
  "government-office": [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Certificates", "Identity documents", "Licences and permits", "Welfare schemes", "Tax services", "General enquiry"] },
    { id: "applicationType", label: "Application type", type: "text", placeholder: "Enter the application or service type" },
    { id: "applicationNumber", label: "Application number", type: "text", placeholder: "Enter the application number" }
  ],
  "railway-counter": [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Ticket booking", "Ticket cancellation", "Reservation enquiry", "Platform ticket", "Season ticket", "Parcel services"] },
    { id: "journeyDate", label: "Journey date", type: "date" },
    { id: "passengerCount", label: "Number of passengers", type: "number", placeholder: "Enter passenger count" }
  ],
  "ration-store": [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Monthly ration collection", "Ration card update", "New ration card", "Family member update", "Grievance", "General enquiry"] },
    { id: "rationCardNumber", label: "Ration card number", type: "text", placeholder: "Enter your ration card number" }
  ],
  restaurant: [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Table booking", "Takeaway order", "Dine-in order", "Food delivery", "Billing", "General enquiry"] },
    { id: "restaurantName", label: "Restaurant name", type: "text", placeholder: "Enter the restaurant name" },
    { id: "reservationDate", label: "Reservation date", type: "date" },
    { id: "guestCount", label: "Number of guests", type: "number", placeholder: "Enter guest count" }
  ],
  salon: [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Haircut", "Hair styling", "Facial and skincare", "Manicure and pedicure", "Makeup", "General consultation"] },
    { id: "salonService", label: "Service required", type: "text", placeholder: "Enter the service you need" },
    { id: "preferredDate", label: "Preferred date", type: "date" }
  ],
  "service-center": [
    { id: "queueCategory", label: "Queue category", type: "select", options: ["Screen repair", "Battery replacement", "Software support", "Hardware repair", "Accessories", "Warranty service"] },
    { id: "mobileModel", label: "Mobile model", type: "text", placeholder: "Enter your mobile model" },
    { id: "serviceDate", label: "Date of service", type: "date" }
  ]
};

const $ = id => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(adminKey ? { "x-admin-key": adminKey } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => element.classList.remove("show"), 2500);
}

function showPanel(panel) {
  $("customerPanel").classList.toggle("hidden", panel !== "customer");
  $("adminPanel").classList.toggle("hidden", panel !== "admin");

  if (panel === "admin") {
    if (adminKey) showAdminDashboard();
    else showLogin();
  }
}

function chooseRole(role) {
  if (role === "admin") {
    adminKey = "";
    sessionStorage.removeItem("queuelessAdminKey");
  }
  $("roleModal").classList.add("hidden");
  document.body.classList.remove("pre-entry");
  showPanel(role);
}

function showLogin() {
  $("adminLogin").classList.remove("hidden");
  $("adminDashboard").classList.add("hidden");
}

function showAdminDashboard() {
  $("adminLogin").classList.add("hidden");
  $("adminDashboard").classList.remove("hidden");
  loadAdmin();
}

async function loadServices() {
  try {
    if (!serviceCatalog.length) {
      [serviceCatalog, districtCatalog] = await Promise.all([
        api("/services"),
        api("/districts")
      ]);
      renderLocationOptions();
    }

    const params = new URLSearchParams({
      category,
      location: selectedLocation
    });
    const services = await api(`/services?${params}`);

    const categories = ["All", ...new Set(serviceCatalog.map(service => service.category))];
    $("serviceTypeSelect").innerHTML = categories.map(item => `
      <option value="${escapeHtml(item)}" ${item === category ? "selected" : ""}>
        ${item === "All" ? "All service types" : escapeHtml(item)}
      </option>
    `).join("");
    $("serviceCount").textContent = `${services.length} places`;

    $("serviceGrid").innerHTML = services.length
      ? services.map(service => `
        <article class="service-card panel">
          <div class="service-icon">${service.icon}</div>
          <h3>${escapeHtml(service.name)}</h3>
          <p class="muted">📍 ${escapeHtml(selectedLocation === "All" ? service.location : selectedLocation)}</p>
          <p class="muted">🏷️ ${escapeHtml(service.category)}</p>

          <div class="queue-row">
            <span>👥 ${service.queueLength} waiting</span>
            <span class="wait">⏱️ ~${service.estimatedWaitMinutes} min</span>
          </div>

          <button class="primary" onclick='openJoinModal(${JSON.stringify(service.id)}, ${JSON.stringify(service.name)})'>
            Join Queue
          </button>
        </article>
      `).join("")
      : `<div class="empty panel">No services found.</div>`;
  } catch (error) {
    toast(error.message);
  }
}

function renderLocationOptions() {
  const serviceLocations = serviceCatalog
    .map(service => service.location)
    .filter(item => !TAMIL_NADU_LOCALITIES.includes(item));
  const uniqueServiceLocations = [...new Set(serviceLocations)];
  const districtOptions = districtCatalog.map(district => `
    <option value="${escapeHtml(district.name)}">${escapeHtml(district.name)}</option>
  `).join("");
  const existingLocationOptions = uniqueServiceLocations.map(item => `
    <option value="${escapeHtml(item)}">${escapeHtml(item)}</option>
  `).join("");

  $("locationSelect").innerHTML = `
    <option value="All">All localities</option>
    <optgroup label="Tamil Nadu districts">${districtOptions}</optgroup>
    <optgroup label="Existing service locations">${existingLocationOptions}</optgroup>
  `;
  $("locationSelect").value = selectedLocation;

  $("serviceLocation").innerHTML = `
    <option value="" disabled selected>Choose location</option>
    <optgroup label="Tamil Nadu districts">${districtOptions}</optgroup>
    <optgroup label="Existing service locations">${existingLocationOptions}</optgroup>
  `;
}

function setCategory(value) {
  category = value;
  loadServices();
}

function openJoinModal(serviceId, serviceName) {
  pendingServiceId = serviceId;
  $("customerDetailsForm").reset();
  $("selectedServiceName").textContent = serviceName;
  renderServiceDetails(serviceId);
  $("detailsModal").classList.remove("hidden");
  $("nameInput").focus();
}

function renderServiceDetails(serviceId) {
  const fields = SERVICE_DETAIL_FIELDS[serviceId] || [];
  $("serviceDetails").innerHTML = fields.length
    ? `<div class="service-details-heading">${escapeHtml($("selectedServiceName").textContent)} details</div>`
      + fields.map(field => `
        <label for="${field.id}">${field.label}</label>
        ${field.type === "select"
          ? `<select id="${field.id}" name="${field.id}" required>
              <option value="" disabled selected>Select a bank</option>
              ${field.options.map(option => `<option value="${option}">${option}</option>`).join("")}
            </select>`
          : `<input id="${field.id}" name="${field.id}" type="${field.type}"
              ${field.accept ? `accept="${field.accept}"` : ""}
              ${field.placeholder ? `placeholder="${field.placeholder}"` : ""} required>`}
      `).join("")
    : "";
}

function closeJoinModal() {
  $("detailsModal").classList.add("hidden");
  $("customerDetailsForm").reset();
  pendingServiceId = "";
}

async function joinQueue() {
  const customerName = $("nameInput").value.trim();
  const details = {
    phoneNumber: $("phoneInput").value.trim(),
    dateOfBirth: $("dobInput").value,
    idProof: $("idProofInput").files[0]?.name || ""
  };

  for (const field of SERVICE_DETAIL_FIELDS[pendingServiceId] || []) {
    const input = $(field.id);
    details[field.id] = field.type === "file"
      ? input.files[0]?.name || ""
      : input.value.trim();
  }

  try {
    currentTicket = await api(`/queues/${pendingServiceId}/join`, {
      method: "POST",
      body: JSON.stringify({ customerName, details })
    });

    closeJoinModal();
    renderTicket();
    loadServices();
    $("ticketPanel").scrollIntoView({ behavior: "smooth", block: "center" });
    toast(`Token #${currentTicket.tokenNumber} created`);
  } catch (error) {
    toast(error.message);
  }
}

function renderTicket() {
  const ticket = currentTicket;
  $("ticketPanel").classList.remove("hidden");
  $("ticketPanel").innerHTML = `
    <small>YOUR QUEUE TOKEN</small>
    <div class="token">#${ticket.tokenNumber}</div>
    <h2>${escapeHtml(ticket.serviceName)}</h2>
    <div class="ticket-grid">
      <div class="ticket-stat"><strong>${ticket.position}</strong><span>Your position</span></div>
      <div class="ticket-stat"><strong>${ticket.estimatedWaitingMinutes} min</strong><span>Estimated wait</span></div>
      <div class="ticket-stat"><strong>${ticket.status}</strong><span>Status</span></div>
    </div>
    <button class="danger" onclick="leaveQueue()">Leave Queue</button>
  `;
}

async function refreshTicket() {
  try {
    currentTicket = await api(`/tickets/${currentTicket.id}`);
    renderTicket();
  } catch (error) {
    toast(error.message);
  }
}

async function leaveQueue() {
  if (!currentTicket) return;

  try {
    await api(`/tickets/${currentTicket.id}`, { method: "DELETE" });
    currentTicket = null;
    $("ticketPanel").classList.add("hidden");
    loadServices();
    toast("You left the queue");
  } catch (error) {
    toast(error.message);
  }
}

async function loginAdmin(event) {
  event.preventDefault();

  try {
    const result = await api("/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("adminUsername").value.trim(),
        password: $("adminPassword").value
      })
    });

    adminKey = result.adminKey;
    sessionStorage.setItem("queuelessAdminKey", adminKey);
    $("adminPassword").value = "";
    showAdminDashboard();
    toast("Admin login successful");
  } catch (error) {
    toast(error.message);
  }
}

async function loadAdmin() {
  if (!adminKey) return showLogin();

  try {
    const dashboard = await api("/admin/dashboard");

    $("stats").innerHTML = `
      <div class="stat panel"><strong>${dashboard.totalWaiting}</strong><span>Waiting</span></div>
      <div class="stat panel"><strong>${dashboard.totalCompleted}</strong><span>Completed</span></div>
      <div class="stat panel"><strong>${dashboard.totalCancelled}</strong><span>Cancelled</span></div>
      <div class="stat panel"><strong>${dashboard.services.length}</strong><span>Queue places</span></div>
    `;

    $("adminGrid").innerHTML = dashboard.services.map(service => `
      <article class="admin-card panel">
        <h2>${service.icon} ${escapeHtml(service.name)}</h2>
        <p>${escapeHtml(service.category)} · 📍 ${escapeHtml(service.location)}</p>
        <p>👥 <b>${service.waitingCount}</b> waiting</p>
        <p>⏱️ Average: <b>${service.averageServiceMinutes} min</b></p>

        <div class="next-customer">
          ${
            service.nextTicket
              ? `Next token <b>#${service.nextTicket.tokenNumber}</b><br>
                 👤 ${escapeHtml(service.nextTicket.customerName)}`
              : "No customers waiting"
          }
        </div>

        <div class="admin-card-actions">
          <button class="primary"
            ${service.nextTicket ? "" : "disabled"}
            onclick="callNext(${JSON.stringify(service.id)})">
            📣 Call Next Customer
          </button>
          <button class="outline-danger"
            ${service.waitingCount ? "disabled" : ""}
            onclick="deactivateService(${JSON.stringify(service.id)})">
            Deactivate
          </button>
        </div>
      </article>
    `).join("");

    const recent = await api("/admin/recent");
    $("recentActivity").innerHTML = recent.length
      ? recent.map(ticket => `
          <div class="recent">
            <span>
              <b>#${ticket.tokenNumber}</b>
              ${escapeHtml(ticket.customerName)}
              — ${escapeHtml(ticket.serviceName)}
              <small class="recent-details">
                ${Object.entries(ticket.details || {}).map(([key, value]) =>
                  `${escapeHtml(formatDetailLabel(key))}: ${escapeHtml(value || "Not provided")}`
                ).join(" · ")}
              </small>
            </span>
            <span class="status ${ticket.status.toLowerCase()}">${ticket.status}</span>
          </div>
        `).join("")
      : `<div class="empty">No activity yet.</div>`;

    const directory = await api("/admin/tamil-nadu-directory");
    $("tamilNaduDirectory").innerHTML = `
      <div class="database-summary">
        <strong>${directory.districts.length}</strong> Tamil Nadu districts ·
        <strong>${directory.services.length}</strong> active services
      </div>
      <div class="database-list">
        ${directory.services.map(service => `
          <div class="database-row">
            <span><b>${escapeHtml(service.name)}</b><small>${escapeHtml(service.category)}</small></span>
            <span>${escapeHtml(service.location)} · ~${service.averageMinutes} min</span>
          </div>
        `).join("")}
      </div>
      <div class="district-list">
        ${directory.districts.map(district => `<span>${escapeHtml(district.name)}</span>`).join("")}
      </div>
    `;
  } catch (error) {
    if (error.message.toLowerCase().includes("admin login")) {
      adminKey = "";
      sessionStorage.removeItem("queuelessAdminKey");
      showLogin();
    }
    toast(error.message);
  }
}

async function callNext(serviceId) {
  try {
    const result = await api(`/admin/services/${serviceId}/next`, { method: "POST" });
    toast(result.message);
    await loadAdmin();
    await loadServices();
    if (currentTicket) await refreshTicket();
  } catch (error) {
    toast(error.message);
  }
}

async function addService(event) {
  event.preventDefault();

  try {
    await api("/admin/services", {
      method: "POST",
      body: JSON.stringify({
        name: $("serviceName").value,
        category: $("serviceCategory").value,
        location: $("serviceLocation").value,
        icon: $("serviceIcon").value,
        avg: $("serviceAvg").value
      })
    });

    event.target.reset();
    $("serviceIcon").value = "📍";
    $("serviceAvg").value = 10;

    toast("New queue place added");
    await loadAdmin();
    await loadServices();
  } catch (error) {
    toast(error.message);
  }
}

async function deactivateService(serviceId) {
  if (!confirm("Deactivate this queue place?")) return;

  try {
    const result = await api(`/admin/services/${serviceId}`, { method: "DELETE" });
    toast(result.message);
    await loadAdmin();
    await loadServices();
  } catch (error) {
    toast(error.message);
  }
}

function logoutAdmin() {
  adminKey = "";
  sessionStorage.removeItem("queuelessAdminKey");
  showLogin();
  toast("Logged out");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDetailLabel(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, character => character.toUpperCase());
}

$("chooseCustomerBtn").addEventListener("click", () => chooseRole("customer"));
$("chooseAdminBtn").addEventListener("click", () => chooseRole("admin"));
$("loginForm").addEventListener("submit", loginAdmin);
$("addServiceForm").addEventListener("submit", addService);
$("customerDetailsForm").addEventListener("submit", event => {
  event.preventDefault();
  joinQueue();
});
$("refreshAdminBtn").addEventListener("click", loadAdmin);
$("logoutBtn").addEventListener("click", logoutAdmin);
$("closeDetailsBtn").addEventListener("click", closeJoinModal);
$("cancelDetailsBtn").addEventListener("click", closeJoinModal);
$("detailsModal").addEventListener("click", event => {
  if (event.target.id === "detailsModal") closeJoinModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$('detailsModal').classList.contains("hidden")) {
    closeJoinModal();
  }
});

$("locationSelect").addEventListener("change", event => {
  selectedLocation = event.target.value;
  loadServices();
});

$("serviceTypeSelect").addEventListener("change", event => {
  setCategory(event.target.value);
});

setInterval(async () => {
  await loadServices();
  if (currentTicket) await refreshTicket();
  if (!$("adminPanel").classList.contains("hidden") && adminKey) await loadAdmin();
}, 8000);

loadServices();
