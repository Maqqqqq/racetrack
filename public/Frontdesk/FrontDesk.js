document.addEventListener("DOMContentLoaded", () => {
    // Utility functions
    const $ = (id) => document.getElementById(id);
    const show = (el) => {
        el.style.display = "flex";
    };
    const hide = (el) => {
        el.style.display = "none";
    };
    const showNotification = (message, type = "info") => {
        const notification = $("notification");
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        setTimeout(() => {
            notification.classList.remove("show");
        }, 3000);
    };

    // DOM Elements
    const elements = {
        raceList: $("race-list"),
        raceForm: $("race-form"),
        raceSearch: $("race-search"),
        raceDetailsName: $("race-details-name"),
        raceDetailsTime: $("race-details-time"),
        raceDetailsDriverCount: $("race-details-driver-count"),
        raceDetailsDrivers: $("race-details-drivers"),
        connectionStatus: $("connection-status"),
        lastUpdate: $("last-update"),
        addDriverBtn: $("add-driver-btn"),
        deleteRaceBtn: $("delete-race-btn"),

        // Modals
        modals: {
            changeName: $("change-name-modal"),
            addDriver: $("add-driver-modal"),
            editDriver: $("edit-driver-modal"),
            deleteRace: $("delete-race-modal"),
            deleteDriver: $("delete-driver-modal"),
        },

        // Forms
        forms: {
            changeName: $("change-name-form"),
            addDriver: $("add-driver-form"),
            editDriver: $("edit-driver-form"),
        },

        // Buttons
        buttons: {
            confirmDelete: $("confirm-delete"),
            cancelDelete: $("cancel-delete"),
            changeName: $("change-name-btn"),
            cancelChangeName: $("cancel-change-name"),
            cancelAddDriver: $("cancel-add-driver"),
            cancelEditDriver: $("cancel-edit-driver"),
            confirmDeleteDriver: $("confirm-delete-driver"),
        }
    };

    let races = [];
    let selectedRaceId = null;
    let selectedDriverId = null;
    let lastUpdateTime = new Date();

    // Socket.IO connection
    const socket = io(window.location.origin, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // Initialize the application
    init();

    function init() {
        fetchRaces();
        clearRaceDetails();
        registerSocketEvents();
        registerDOMEvents();
        initMobileSupport();
        updateLastUpdateTime();
        // THEME TOGGLE
        const themeSwitch = document.getElementById('theme-switch');
        const body = document.body;
        // Load theme from localStorage
        if (localStorage.getItem('theme') === 'light') {
            body.classList.add('light-theme');
            if (themeSwitch) themeSwitch.checked = true;
        }
        if (themeSwitch) {
            themeSwitch.addEventListener('change', function() {
                if (this.checked) {
                    body.classList.add('light-theme');
                    localStorage.setItem('theme', 'light');
                    this.setAttribute('aria-checked', 'true');
                } else {
                    body.classList.remove('light-theme');
                    localStorage.setItem('theme', 'dark');
                    this.setAttribute('aria-checked', 'false');
                }
            });
        }
        // After initial fetch, if no race is selected, select the first one (if available)
        // This handles the initial display after races are loaded.
        setTimeout(() => {
            if (selectedRaceId === null && races.length > 0) {
                showRaceDetails(races[0].id);
            }
        }, 100); // Small delay to ensure races are fetched
    }

    function registerSocketEvents() {
        socket.on("connect", () => {
            elements.connectionStatus.textContent = "Connected";
            elements.connectionStatus.style.color = "var(--success)";
        });

        socket.on("disconnect", () => {
            elements.connectionStatus.textContent = "Disconnected";
            elements.connectionStatus.style.color = "var(--danger)";
        });

        socket.on("racesList", (newRaces) => {
            console.log("Socket: racesList received", newRaces);
            races = newRaces;
            renderRaces(races);
            // After receiving updated list, re-show details of the currently selected race if it still exists
            if (selectedRaceId) {
                const currentSelectedRace = races.find(r => String(r.id) === String(selectedRaceId));
                if (currentSelectedRace) {
                    showRaceDetails(selectedRaceId);
                } else {
                    // If selected race was deleted, clear details
                    clearRaceDetails();
                    selectedRaceId = null; // Clear selected ID if race is gone
                }
            } else if (races.length > 0) {
                // If no race was selected, but there are races, select the first one by default
                showRaceDetails(races[0].id);
            } else {
                clearRaceDetails();
                selectedRaceId = null;
            }
        });

        socket.on("raceCreated", (race) => {
            console.log("Socket: raceCreated", race);
            fetchRaces(); // Triggers a full refresh of races list and re-evaluation of selectedRaceId
        });

        socket.on("raceUpdated", (updatedRace) => {
            console.log("Socket: raceUpdated", updatedRace);
            // Find the index of the updated race in the local races array
            const index = races.findIndex(r => String(r.id) === String(updatedRace.id));
            if (index > -1) {
                // Replace the old race object with the updated one
                races[index] = updatedRace;
            }

            // If the updated race is the currently selected one, re-display its details
            if (String(updatedRace.id) === String(selectedRaceId)) {
                showRaceDetails(updatedRace.id); // Re-display details with fresh data
            } else {
                // If a different race was updated, just re-fetch the list (it might affect sorting/counts)
                // Or simply re-render the race list to ensure the main list is updated.
                renderRaces(races); 
            }
        });

        socket.on("raceDeleted", (raceId) => {
            console.log("Socket: raceDeleted", raceId);
            fetchRaces(); // Triggers a full refresh and re-evaluation of selectedRaceId
        });

        socket.on("error", (error) => {
            showNotification(error.message || "An error occurred", "error");
        });
    }

    function registerDOMEvents() {
        // Search functionality
        if (elements.raceSearch) {
            elements.raceSearch.addEventListener("input", (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredRaces = races.filter(race => 
                    race.name.toLowerCase().includes(searchTerm)
                );
                renderRaces(filteredRaces);
            });
        }

        // Add Driver button
        if (elements.addDriverBtn) {
            elements.addDriverBtn.onclick = () => {
                if (!selectedRaceId) {
                    showNotification("Please select a race first", "warning");
                    return;
                }
                show(elements.modals.addDriver);
            };
        }

        // Delete Race button
        if (elements.deleteRaceBtn) {
            elements.deleteRaceBtn.onclick = () => {
                if (!selectedRaceId) {
                    showNotification("Please select a race first", "warning");
                    return;
                }
                show(elements.modals.deleteRace);
            };
        }

        // Form submissions
        if (elements.forms.changeName) {
            elements.forms.changeName.onsubmit = handleChangeRaceName;
        }
        if (elements.forms.addDriver) {
            elements.forms.addDriver.onsubmit = handleAddDriver;
        }

        // Button click handlers
        if (elements.buttons.changeName) {
            elements.buttons.changeName.onclick = () => {
                if (!selectedRaceId) {
                    showNotification("Please select a race first", "warning");
                    return;
                }
                show(elements.modals.changeName);
            };
        }

        if (elements.buttons.confirmDelete) {
            elements.buttons.confirmDelete.onclick = () => {
                if (!selectedRaceId) {
                    showNotification("Please select a race first", "warning");
                    return;
                }
                handleDeleteRace(selectedRaceId);
            };
        }

        // Cancel buttons
        Object.values(elements.buttons).forEach(btn => {
            if (btn && btn.id && btn.id.startsWith("cancel")) {
                btn.onclick = closeModals;
            }
        });

        // Add new race
        if (elements.raceForm) {
            elements.raceForm.onsubmit = async (e) => {
                e.preventDefault();
                const name = $("race-name").value;
                try {
                    const res = await fetch("/api/races", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name }),
                    });
                    if (!res.ok) {
                        const error = await res.json();
                        throw new Error(error.message || "Failed to create race");
                    }
                    elements.raceForm.reset();
                    showNotification("Race created successfully!", "success");
                    fetchRaces();
                } catch (error) {
                    showNotification(error.message, "error");
                }
            };
        }

        // Close modals when clicking outside
        window.onclick = (e) => {
            if (e.target.classList.contains("modal")) {
                closeModals();
            }
        };

        // Handle keyboard shortcuts
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeModals();
            }
        });
    }

    function closeModals() {
        Object.values(elements.modals).forEach(modal => {
            if (modal) hide(modal);
        });
    }

    async function fetchRaces() {
        try {
            const res = await fetch("/api/races");
            if (!res.ok) {
                throw new Error("Failed to fetch races");
            }
            races = await res.json();
            // console.log("DEBUG: races from backend - ", races); // Removed console.log
            renderRaces(races); // Just render the list, don't automatically select details here
            // Removed the `if (selectedRaceId)` and `else if (races.length > 0)` block here.
            // The socket.on('racesList') will handle re-displaying race details.
        } catch (error) {
            showNotification(error.message, "error");
        }
    }

    function renderRaces(races) {
        if (!elements.raceList) return;
        
        elements.raceList.innerHTML = "";
        races.forEach(({ id, name, time, drivers }) => {
            const li = document.createElement("li");
            const raceTime = time ? new Date(time).toLocaleString() : "";
            
            li.innerHTML = `
                <div class="race-info">
                    <strong>${name}</strong>
                    <span class="race-time">${raceTime}</span>
                </div>
                <span class="driver-count">${drivers.length} drivers</span>
            `;
            
            li.onclick = () => showRaceDetails(id);
            elements.raceList.appendChild(li);
        });
    }

    function showRaceDetails(raceId) {
        const race = races.find(r => String(r.id) === String(raceId));
        if (!race) return;

        console.log("showRaceDetails: Rendering details for race:", JSON.stringify(race, null, 2));

        selectedRaceId = raceId;
        elements.raceDetailsName.textContent = race.name;
        elements.raceDetailsTime.textContent = race.time ? new Date(race.time).toLocaleString() : "";
        elements.raceDetailsDriverCount.textContent = race.drivers.length;
        // Clear existing driver list before re-rendering
        elements.raceDetailsDrivers.innerHTML = ""; 

        race.drivers.forEach(driver => {
            const li = document.createElement("li");
            li.classList.add("driver-card");

            const driverInfoDiv = document.createElement("div");
            driverInfoDiv.classList.add("driver-info");
            console.log(`showRaceDetails: Driver ${driver.name}, Car Assigned: ${driver.carAssigned}`);
            driverInfoDiv.innerHTML = `<strong>${driver.name}</strong> <span class="car-id">Car ${driver.carAssigned}</span>`;
            li.appendChild(driverInfoDiv);

            const driverActionsDiv = document.createElement("div");
            driverActionsDiv.classList.add("driver-actions");

            const editButton = document.createElement("button");
            editButton.classList.add("secondary-btn");
            editButton.innerHTML = `<i class="fas fa-edit"></i> Edit`;
            editButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openEditDriverModal(race.id, driver.id);
            });
            driverActionsDiv.appendChild(editButton);

            const removeButton = document.createElement("button");
            removeButton.classList.add("danger-btn");
            removeButton.innerHTML = `<i class="fas fa-trash"></i> Remove`;
            removeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                openDeleteDriverModal(race.id, driver.id);
            });
            driverActionsDiv.appendChild(removeButton);

            li.appendChild(driverActionsDiv);
            elements.raceDetailsDrivers.appendChild(li);
        });
    }

    function clearRaceDetails() {
        if (elements.raceDetailsName) elements.raceDetailsName.textContent = "";
        if (elements.raceDetailsTime) elements.raceDetailsTime.textContent = "";
        if (elements.raceDetailsDriverCount) elements.raceDetailsDriverCount.textContent = "";
        if (elements.raceDetailsDrivers) elements.raceDetailsDrivers.innerHTML = "";
    }

    function openEditDriverModal(raceId, driverId) {
        const raceIdStr = String(raceId);
        const driverIdStr = String(driverId);

        const race = races.find(r => {
            // console.log(`Edit Modal - Comparing Race: r.id=${r.id} (${typeof r.id}), raceIdStr=${raceIdStr} (${typeof raceIdStr}), Match: ${String(r.id) === raceIdStr}`); // Removed console.log
            return String(r.id) === raceIdStr;
        });

        const driver = race && race.drivers ? race.drivers.find(d => {
            // console.log(`Edit Modal - Comparing Driver: d.id=${d.id} (${typeof d.id}), driverIdStr=${driverIdStr} (${typeof driverIdStr}), Match: ${String(d.id) === driverIdStr}`); // Removed console.log
            return String(d.id) === driverIdStr;
        }) : null;

        if (!race || !driver) {
            showNotification("Could not find race or driver to edit. Please refresh.", "error");
            return;
        }

        selectedRaceId = raceId;
        selectedDriverId = driverId;

        if ($("edit-driver-name")) $("edit-driver-name").value = driver.name;
        if ($("edit-car-id")) $("edit-car-id").value = driver.carAssigned.replace(/^(Car\s*)+/i, '');

        if (elements.forms.editDriver) {
            elements.forms.editDriver.onsubmit = handleEditDriver;
        }

        show(elements.modals.editDriver);
    }

    function openDeleteDriverModal(raceId, driverId) {
        const raceIdStr = String(raceId);
        const driverIdStr = String(driverId);

        const race = races.find(r => {
            // console.log(`Delete Modal - Comparing Race: r.id=${r.id} (${typeof r.id}), raceIdStr=${raceIdStr} (${typeof raceIdStr}), Match: ${String(r.id) === raceIdStr}`); // Removed console.log
            return String(r.id) === raceIdStr;
        });

        const driver = race && race.drivers ? race.drivers.find(d => {
            // console.log(`Delete Modal - Comparing Driver: d.id=${d.id} (${typeof d.id}), driverIdStr=${driverIdStr} (${typeof driverIdStr}), Match: ${String(d.id) === driverIdStr}`); // Removed console.log
            return String(d.id) === driverIdStr;
        }) : null;

        if (!race || !driver) {
            showNotification("Could not find race or driver to delete. Please refresh.", "error");
            return;
        }
        selectedRaceId = raceId;
        selectedDriverId = driverId;

        if (elements.buttons.confirmDeleteDriver) {
            elements.buttons.confirmDeleteDriver.onclick = removeDriver;
        }
        show(elements.modals.deleteDriver);
    }

    async function handleChangeRaceName(e) {
        e.preventDefault();
        const newName = $("new-race-name").value;

        try {
            const res = await fetch(`/api/races/${selectedRaceId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update race name");
            }

            fetchRaces();
            showRaceDetails(selectedRaceId);
            closeModals();
            showNotification("Race name updated successfully!", "success");
        } catch (error) {
            showNotification(error.message, "error");
        }
    }

    async function handleAddDriver(e) {
        e.preventDefault();
        const driverName = $("driver-name").value;
        const carId = $("car-id").value;

        if (!driverName || !carId) {
            showNotification("Driver name and car ID are required", "warning");
            return;
        }

        try {
            const res = await fetch(`/api/races/${selectedRaceId}/create-driver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ driverName, carId }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || "Failed to create driver");
            }

            closeModals();
            showNotification("Driver added successfully!", "success");
            fetchRaces();
        } catch (error) {
            showNotification(error.message, "error");
        }
    }

    async function handleEditDriver(e) {
        e.preventDefault();
        if (!selectedRaceId || !selectedDriverId) {
            showNotification("Error: Race or driver not selected for editing.", "error");
            return;
        }

        const newName = $("edit-driver-name").value;
        const newCarId = $("edit-car-id").value;

        console.log(`handleEditDriver: raceId = "${selectedRaceId}" , driverId = "${selectedDriverId}"`); // Re-add for debugging if needed
        console.log(`handleEditDriver: newName = "${newName}" , newCarId = "${newCarId}"`); // Re-add for debugging if needed

        try {
            const res = await fetch(`/api/races/${selectedRaceId}/drivers/${selectedDriverId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, carAssigned: newCarId }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to update driver");
            }

            closeModals();
            showNotification("Driver updated successfully!", "success");
            // No need to call fetchRaces() here, socket.io will handle the update
            // fetchRaces(); // This was causing selectedRaceId to sometimes be reset
            // showRaceDetails(selectedRaceId); // Also not needed here, socket.io will re-render
        } catch (error) {
            showNotification(error.message, "error");
        }
    }

    async function handleDeleteRace(raceIdToDelete) {
        try {
            const res = await fetch(`/api/races/${raceIdToDelete}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to delete race");
            }

            closeModals();
            showNotification("Race deleted successfully!", "success");
        } catch (error) {
            showNotification(error.message, "error");
        }
    }

    async function removeDriver() {
        if (!selectedRaceId || !selectedDriverId) {
            showNotification("Error: Race or driver not selected for deletion.", "error");
            return;
        }
        // console.log(`removeDriver: raceId = "${selectedRaceId}", driverId = "${selectedDriverId}"`); // Re-add for debugging if needed

        try {
            const res = await fetch(`/api/races/${selectedRaceId}/drivers/${selectedDriverId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to remove driver");
            }

            closeModals();
            showNotification("Driver removed successfully!", "success");
            // fetchRaces() will be triggered by raceDeleted socket event now
        } catch (error) {
            showNotification(error.message, "error");
        }
    }

    function initMobileSupport() {
        // Add touch feedback
        document.querySelectorAll("button, li").forEach(el => {
            el.addEventListener("touchstart", () => {
                el.classList.add("touch-active");
            });
            el.addEventListener("touchend", () => {
                el.classList.remove("touch-active");
            });
        });

        // Handle orientation changes
        window.addEventListener("resize", adjustForMobile);
        adjustForMobile();
    }

    function adjustForMobile() {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle("mobile", isMobile);
    }

    function updateLastUpdateTime() {
        lastUpdateTime = new Date();
        if (elements.lastUpdate) {
            elements.lastUpdate.textContent = `Last updated: ${lastUpdateTime.toLocaleTimeString()}`;
        }
    }
});
  