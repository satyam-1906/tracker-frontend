const start_location = getUserLocation()
var coords = [0.0, 0.0]

var map = L.map('map', {
    center: coords,
    zoom: 13
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markerRegistry = {}

const markerGroup = L.layerGroup().addTo(map);

const marker = L.marker(coords).addTo(map);
marker.bindPopup("Me").openPopup();


function getUserLocation() {
  // 1. Check if the browser supports the Geolocation API
  if (!("geolocation" in navigator)) {
    console.error("Geolocation is not supported by this browser.");
    return;
  }

  // 2. Configure high accuracy and timeout limits
  const options = {
    enableHighAccuracy: true, // Forces device GPS over IP lookup if available
    timeout: 10000,           // Wait maximum 10 seconds for coordinates
    maximumAge: 0             // Force fresh location request, do not use cached data
  };

  // 3. Request permission and fetch coordinates
  navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
}

// Handles successful permission and coordinate gathering
function successCallback(position) {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const accuracy = position.coords.accuracy; // Error radius in meters

  coords = [latitude, longitude];
}

function errorCallback(error) {
  switch(error.code) {
    case error.PERMISSION_DENIED:
      console.error("User denied the request for Geolocation.");
      break;
    case error.POSITION_UNAVAILABLE:
      console.error("Location information is unavailable.");
      break;
    case error.TIMEOUT:
      console.error("The request to get user location timed out.");
      break;
    case error.UNKNOWN_ERROR:
      console.error("An unknown error occurred.");
      break;
  }
}

async function fetchData() {
  try {
    // 1. Initiate the GET request (fetch uses GET by default)
    const response = await fetch('https://tracker-oeqy.onrender.com/getMarker');
    
    // 2. Check if the HTTP status code is successful (200-299)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const my_location = getUserLocation()
    // 3. Parse the streaming response body into a JSON object
    const data = await response.json();
    data.forEach(element => {
        const markerId = element.device_id
        if (markerRegistry[markerId]) {
            markerRegistry[markerId].slideTo([parseFloat(element.last_coords[0]), parseFloat(element.last_coords[1])], {duration: 1000, keepAtCenter: false});
        }
        else {
            const newMarker = L.marker([parseFloat(element.last_coords[0]), parseFloat(element.last_coords[1])]).bindPopup(`${markerId}`, {autoPan: false});
            
            markerGroup.addLayer(newMarker);
            markerRegistry[markerId] = newMarker;
        }
        //console.log(parseFloat(element.last_coords[0]), parseFloat(element.last_coords[1]), element.device_id)
        //create_marker(parseFloat(element.last_coords[0]), parseFloat(element.last_coords[1]), element.device_id)
    });

    const incomingIds = data.map(d => d.device_id);
    Object.keys(markerRegistry).forEach(id => {
        if (!incomingIds.includes(String(id))) {
            markerGroup.removeLayer(markerRegistry[id]);
            delete markerRegistry[id];
        }
    });
    //map.setView(coords, map.getZoom(), {animate:true, duration:1});
    marker.slideTo(coords, {duration: 1000, keepAtCenter: false});
    
    // Update active devices list UI
    update_device_list(data);
  } catch (error) {
    // 4. Handle network-level failures or thrown errors
    console.error('Fetch failed:', error);
  }
}

setInterval(fetchData, 10000);

const button = document.getElementById('refresh_btn');

if (button){
    button.addEventListener('submit', async (e) => {
        await refresh()
    })
};

async function refresh() {
    try {
        const response = await fetch('https://tracker-oeqy.onrender.com/newUser')

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        sync_user_list()
        update_alarm_list()

    } catch (error) {
        console.error('New user creation failed: ', error)
    }
}

const alarmForm = document.getElementById("alarm_form")
if (alarmForm) {
  alarmForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    await add_alarm()
    alarmForm.reset()
  })
}

async function add_alarm() {
  try {
    var alarms = JSON.parse(localStorage.getItem("alarms"))
    const dropdown = document.getElementById("user_list")
    const newAlarmDevice = dropdown.value

    if (newAlarmDevice === "" || newAlarmDevice == "None") {
      alert("Select a valid Device.")
      return
    }
    
    const newAlarmDistance = document.getElementById("alert_distance").value

    alarms.forEach(element => {
      if (element.device_id == newAlarmDevice && element.distance == newAlarmDistance) {
        alert("Duplicate alarm already set.")
        return
      }
    });

    const newAlarm = {"device_id": newAlarmDevice, "distance": parseFloat(newAlarmDistance)}
    const response = await fetch('https://tracker-oeqy.onrender.com/setAlarm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newAlarm)
    });

    if(!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const mergedAlarms = [...alarms, newAlarm]
    localStorage.setItem("alarms", JSON.stringify(mergedAlarms))
    update_alarm_list()
    
  } catch (error) {
    console.error(error)
  }
}

document.addEventListener("DOMContentLoaded", () => {
    set_alarms_in_local_storage();
    update_alarm_list()
    sync_user_list()
    setup_tabs()
});

function setup_tabs() {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Deactivate all tabs
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      
      // Activate clicked tab
      button.classList.add('active');
      const targetContent = document.getElementById(`tab-${tabName}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

function update_device_list(data) {
  const deviceList = document.getElementById("device_list");
  if (!deviceList) return;
  
  deviceList.replaceChildren();
  
  if (data.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.style.justifyContent = 'center';
    emptyLi.style.color = 'var(--text-secondary)';
    emptyLi.textContent = 'No active devices';
    deviceList.appendChild(emptyLi);
    return;
  }
  
  data.forEach(element => {
    const lat = parseFloat(element.last_coords[0]).toFixed(5);
    const lng = parseFloat(element.last_coords[1]).toFixed(5);
    
    const li = document.createElement('li');
    li.className = 'device-item';
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'device-info';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'device-name';
    nameSpan.textContent = element.device_id;
    
    const coordsSpan = document.createElement('span');
    coordsSpan.className = 'device-coords';
    coordsSpan.textContent = `Lat: ${lat}, Lng: ${lng}`;
    
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(coordsSpan);
    
    const locateBtn = document.createElement('button');
    locateBtn.className = 'locate-btn';
    locateBtn.textContent = 'Locate';
    
    const locateHandler = (e) => {
      e.stopPropagation();
      const deviceMarker = markerRegistry[element.device_id];
      if (deviceMarker) {
        map.setView(deviceMarker.getLatLng(), 15, { animate: true });
        deviceMarker.openPopup();
      }
    };
    
    locateBtn.addEventListener('click', locateHandler);
    li.addEventListener('click', locateHandler);
    
    li.appendChild(infoDiv);
    li.appendChild(locateBtn);
    deviceList.appendChild(li);
  });
}

async function set_alarms_in_local_storage() {
  const response = await fetch('https://tracker-oeqy.onrender.com/getAlarms')
  const data = await response.json()

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  localStorage.setItem("alarms", JSON.stringify(data))
}

async function update_alarm_list() {
  const data = localStorage.getItem("alarms")
  var alarms
  if (data) {
    alarms = JSON.parse(data)}
  else
    return
  document.getElementById("alarm_list").replaceChildren()
  const alarmList = document.getElementById("alarm_list")
  alarms.forEach(element => {
    const li = document.createElement('li')
    var text = `${element.device_id} ${element.distance}`
    const textNode = document.createTextNode(text + " ")
    li.appendChild(textNode)

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'x';
    cancelBtn.className = 'cancel-btn';

    li.appendChild(cancelBtn);
    alarmList.appendChild(li);
  })
}

async function sync_user_list() {
  const response = await fetch('https://tracker-oeqy.onrender.com/getUsers')
  
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json()

  const userList = document.getElementById("user_list")
  userList.replaceChildren()
  const optionNone = document.createElement('option')
  const textNodeNone = document.createTextNode('None')
  optionNone.appendChild(textNodeNone)
  userList.appendChild(optionNone)

  data.forEach(element => {
    const option = document.createElement('option')
    const textNode = document.createTextNode(`${element.device_id}`)
    option.appendChild(textNode)

    userList.appendChild(option)
  })

}

document.getElementById("alarm_list").addEventListener('click', async function(event) {
  if (event.target.classList.contains('cancel-btn')) {
    const splits = event.target.closest('li').innerText.split(" ")
    const alarm = {"device_id": splits[0], "distance": parseFloat(splits[1])}
    const response = await fetch('https://tracker-oeqy.onrender.com/deleteAlarm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(alarm)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    var alarms = JSON.parse(localStorage.getItem("alarms"))
    alarms.forEach(element => {
      if (element['device_id'] == splits[0] && element['distance'] == parseFloat(splits[1])) {
        alarms.splice(alarms.indexOf(element), 1)
        localStorage.setItem("alarms", JSON.stringify(alarms))
      }
    });
    update_alarm_list()

  }
})