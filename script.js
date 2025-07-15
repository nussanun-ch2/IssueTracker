// วาง URL ของเว็บแอปที่คุณคัดลอกมาจาก Google Apps Script ตรงนี้
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw97OnZ08jkyXwAdiE56Al4Gs7Ch2mDi3l6YEoiWjinf3XLCdoG7P1ew_9b3sSzzPO8/exec';


// --- DOM Elements ---
const form = document.getElementById('issueForm');
const submitButton = document.getElementById('submitButton');
const statusMessage = document.getElementById('status-message');
const issueTableBody = document.getElementById('issueTableBody');
const imageInput = document.getElementById('issueImage');

// Page navigation elements
const navView = document.getElementById('nav-view');
const navAdd = document.getElementById('nav-add');
const pageView = document.getElementById('page-view-issues');
const pageAdd = document.getElementById('page-add-issue');

// Edit Modal elements
const editModal = document.getElementById('editModalOverlay');
const editForm = document.getElementById('editForm');
const closeEditModalBtn = document.getElementById('closeEditModal');
const saveEditBtn = document.getElementById('saveEditBtn');

// Delete modal elements
const deleteModal = document.getElementById('deleteModalOverlay');
const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let issueIdToDelete = null;

// --- Functions ---

// --- ✨ START: User Identification Functions ---
let currentUserName = '';

/**
 * ดึงชื่อผู้ใช้จาก Local Storage หรือถามผู้ใช้ถ้ายังไม่มี
 */
function initializeUser() {
    let storedName = localStorage.getItem('issueTrackerUserName');
    if (storedName) {
        currentUserName = storedName;
    } else {
        // ถามชื่อผู้ใช้ในครั้งแรก
        storedName = prompt("Please enter your name for 'Request By':", "");
        if (storedName && storedName.trim() !== '') {
            localStorage.setItem('issueTrackerUserName', storedName.trim());
            currentUserName = storedName.trim();
        } else {
            // ถ้าผู้ใช้ไม่ใส่ชื่อ ก็ใช้ค่า default
            currentUserName = 'Anonymous'; 
        }
    }
}
// --- ✨ END: User Identification Functions ---


/**
 * ฟังก์ชันสลับหน้า
 * @param {string} pageId - ID ของหน้าที่ต้องการแสดง
 */
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));

    if (pageId === 'page-add-issue') {
        document.getElementById(pageId).classList.add('active');
        navAdd.classList.add('active');

        // --- ✨ START: เพิ่มโค้ดสำหรับใส่ชื่ออัตโนมัติ ---
        const requestByInput = document.getElementById('RequestBy'); 
        if (requestByInput) {
            requestByInput.value = currentUserName;
        }
        // --- ✨ END: เพิ่มโค้ด ---

    } else {
        pageView.classList.add('active');
        navView.classList.add('active');
    }
}

/**
 * ฟังก์ชันแปลงไฟล์เป็น Base64 string
 */
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * แสดงข้อความสถานะ
 */
function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'error' : 'success';
    statusMessage.style.display = 'block';
    window.scrollTo(0, 0); // Scroll to top to see message
    setTimeout(() => { statusMessage.style.display = 'none'; }, 4000);
}


/**
 * อัปเดตตัวเลือกใน Dropdown ของ Issue Type (สำหรับหน้า Add New)
 * @param {string} selectedSystem - System ที่ถูกเลือก.
 * @param {string} issueTypeDropdownId - ID ของ Dropdown ที่ต้องการอัปเดต.
 */
function updateIssueTypeOptions(selectedSystem, issueTypeDropdownId) {
    const issueTypeSelect = document.getElementById(issueTypeDropdownId);
    if (!issueTypeSelect) return;

    const currentValue = issueTypeSelect.value;

    
    const optionsMap = {
        'SACP': [ 'Calendar', 'Other'], // ไม่มี 'BI Report'
        'SAC-BI&BW': ['BI Report', 'Other'],
        'OTHER': ['Other'],
        'default': ['Calendar', 'BI Report', 'Other']
    };

    const optionsToShow = optionsMap[selectedSystem] || optionsMap['default'];
    
    // ล้างตัวเลือกเก่า
    issueTypeSelect.innerHTML = '<option value="">-- Select Type --</option>';

    // สร้างตัวเลือกใหม่
    optionsToShow.forEach(optionText => {
        const option = document.createElement('option');
        option.value = optionText;
        option.textContent = optionText;
        issueTypeSelect.appendChild(option);
    });

        if (optionsToShow.includes(currentValue)) {
        issueTypeSelect.value = currentValue;
    }
}



/**
 * โหลดข้อมูล Issues ทั้งหมดมาแสดงในตาราง (เวอร์ชันแก้ไข)
 */
async function loadIssues() {
    issueTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">🔄 Loading issues...</td></tr>`;
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const issues = await response.json();
        
        if (issues.result === 'error') {
            throw new Error(issues.message);
        }

        issueTableBody.innerHTML = ''; 

        if (issues.length === 0) {
            issueTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No issues found. 🎉</td></tr>`;
            return;
        }

        issues.forEach(issue => {
            const row = document.createElement('tr');
            
            const actionsHtml = `
                <div class="action-buttons">
                    <button class="edit-btn" data-id="${issue.ID}" title="Edit">✏️</button>
                    <button class="delete-btn" data-id="${issue.ID}" title="Delete">🗑️</button>
                </div>
            `;

            let imageHtml = '';
            const iconSpan = `<span style="font-size: 1.6em; display: block; text-align: center;">${issue.icon || '📄'}</span>`;
            if (issue.ImageUrl && issue.ImageUrl.trim() !== '') {
                imageHtml = `<a href="${issue.ImageUrl}" target="_blank" title="คลิกเพื่อดูรูปภาพ">${iconSpan}</a>`;
            } else {
                imageHtml = iconSpan;
            }

            const statusOptions = ['Open', 'In Progress', 'Closed'];
            let statusHtml = `<select class="status-dropdown" data-id="${issue.ID}">`;
            statusOptions.forEach(option => {
                const isSelected = (option === issue.Status) ? 'selected' : '';
                statusHtml += `<option value="${option}" ${isSelected}>${option}</option>`;
            });
            statusHtml += `</select>`;

           
            row.innerHTML = `
                <td>${imageHtml}</td>
                <td>${issue.RequestBy || ''}</td>
                <td>${issue.Title || ''}</td>
                <td>${issue.Description || ''}</td>
                <td><span class="priority-${issue.Priority}">${issue.Priority || ''}</span></td>
                <td>${statusHtml}</td>
                <td>${issue.Timestamp || ''}</td> 
                <td>${issue.IssueType || ''}</td>
                <td>${issue.Year || ''}</td>
                <td>${actionsHtml}</td>
                <td>${issue.UpdatedBy || ''}</td>
                <td>${issue.UpdatedAt ? new Date(issue.UpdatedAt).toLocaleString('th-TH') : ''}</td>
            `;
            issueTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading issues:", error);
        // ✨ [แก้ไข] เปลี่ยน colspan จาก 11 เป็น 8
        issueTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Failed to load issues: ${error.message}</td></tr>`;
    }
}

/**
 * จัดการการอัปเดตสถานะ
 */
async function handleStatusUpdate(issueId, newStatus) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateStatus', id: issueId, newStatus: newStatus }), 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.result === 'success') {
            showStatus(`Status updated to ${newStatus}`);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, true);
        loadIssues(); 
    }
}

/**
 * เปิดหน้าต่างยืนยันการลบ
 */
function confirmDelete(id) {
    issueIdToDelete = id;
    deleteModal.style.display = 'flex';
}

/**
 * ปิดหน้าต่างยืนยันการลบ
 */
function closeDeleteDialog() {
    issueIdToDelete = null;
    deleteModal.style.display = 'none';
}

/**
 * จัดการการลบข้อมูล
 */
async function handleDelete() {
    if (!issueIdToDelete) return;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting...';

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: issueIdToDelete }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.result === 'success') {
            showStatus('Issue deleted successfully!');
            loadIssues();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showStatus(`Error: ${error.message}`, true);
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = 'ยืนยันการลบ';
        closeDeleteDialog();
    }
}

/**
 * เปิดและเตรียมข้อมูลสำหรับหน้าต่างแก้ไข
 */
async function openEditModal(id) {
    try {
        const response = await fetch(`${SCRIPT_URL}?id=${id}`);
        if (!response.ok) throw new Error('Failed to fetch issue details.');
        const issue = await response.json();
        if (issue.result === 'error') throw new Error(issue.message);

        // --- ส่วนที่ 1: ตั้งค่า System และ Version ---
        const editSystemSelect = document.getElementById('editSystemSelect');
        const editVersionContainer = document.getElementById('editVersionContainer');
        const editVersionSelect = document.getElementById('editVersionSelect');
        
        editSystemSelect.value = issue.System || '';
        if (issue.System === 'SACP') {
            editVersionContainer.style.display = 'block';
            editVersionSelect.required = true;
            editVersionSelect.value = issue.Version || '';
        } else {
            editVersionContainer.style.display = 'none';
            editVersionSelect.required = false;
            editVersionSelect.value = '';
        }

        // --- ส่วนที่ 2: อัปเดตตัวเลือก IssueType ตาม System ที่ได้มา ---
        updateIssueTypeOptions(issue.System, 'editIssueType');

        // --- ส่วนที่ 3: ใส่ค่าทั้งหมดลงในฟอร์มให้ถูกต้อง ---
        document.getElementById('editIssueId').value = issue.ID;
        document.getElementById('editImageUrl').value = issue.ImageUrl || ''; // ใส่ค่า ImageUrl เดิมในช่องที่ซ่อนไว้
        document.getElementById('editRequestBy').value = issue.RequestBy || ''; // ✨ แก้ไข R เป็น r
        document.getElementById('editIssueCategory').value = issue.IssueCategory || '';
        document.getElementById('editTitle').value = issue.Title || '';
        document.getElementById('editDescription').value = issue.Description || '';
        document.getElementById('editPriority').value = issue.Priority || 'Low';

        document.getElementById('editStatus').value = issue.Status || 'Open';
        

        document.getElementById('editIssueType').value = issue.IssueType || '';
        document.getElementById('editYear').value = issue.Year || '';
        
       
        
        // --- ส่วนที่ 4: แสดงชื่อไฟล์เดิม ---
        const currentFileDisplay = document.getElementById('currentFileDisplay');
        if (issue.ImageUrl) {
            currentFileDisplay.innerHTML = `Current file: <a href="${issue.ImageUrl}" target="_blank">${issue.FileName || 'View File'}</a>`;
        } else {
            currentFileDisplay.innerHTML = 'No file attached.';
        }
        document.getElementById('editIssueImage').value = '';

        editModal.style.display = 'flex';
    } catch (error) {
        showStatus(`Error opening edit form: ${error.message}`, true);
        console.error("Detailed error in openEditModal:", error);
    }
}

/**
 * จัดการการบันทึกข้อมูลที่แก้ไข (เวอร์ชันปรับปรุง)
 */
async function handleEditFormSubmit(event) {
    event.preventDefault();
    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'Saving...';

    const formData = new FormData(editForm);
    
    // ✨ [แก้ไข] รวบรวมข้อมูลทั้งหมดจากฟอร์มโดยอัตโนมัติ
    const data = Object.fromEntries(formData.entries());
    
    // แยก issueId ออกมาเก็บไว้ต่างหาก
    const issueId = data.id; 
    
    // ลบ key 'id' ออกจาก object ที่จะส่งไป, เพราะเราจะส่ง id แยกไปแล้ว
    delete data.id;

   // ✨ START: เพิ่มส่วนจัดการไฟล์ที่อัปโหลดใหม่เข้ามา
    const fileInput = document.getElementById('editIssueImage');
    const file = fileInput.files[0];
    if (file) { // ตรวจสอบว่ามีการเลือกไฟล์ใหม่หรือไม่
        if (file.size > 5 * 1024 * 1024) { // ตรวจสอบขนาดไฟล์
            showStatus('Error: File size cannot exceed 5MB.', true);
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = 'Save Changes';
            return;
        }
        // แปลงไฟล์เป็น Base64 แล้วแนบไปกับข้อมูล
        data.fileData = await toBase64(file);
        data.fileName = file.name;
        data.mimeType = file.type;
    }
    delete data.issueImage; // ลบ property ที่ไม่จำเป็นออก
    // ✨ END: ส่วนจัดการไฟล์ใหม่

    // --- ✨ START: จัดการเงื่อนไข System และ Version ---
    if (data.system === 'SACP') {
         // ถ้าเลือก System เป็น SACP, ต้องเลือก Version ด้วย
        if (!data.version) {
            showStatus('Error: Please select a Version for SACP system.', true);
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = 'Save Changes';
            return; // หยุดการทำงานของฟังก์ชัน
        }
         // ✨ เพิ่มใหม่: ถ้าเลือก SACP, ห้ามเลือก Issue Type เป็น 'BI Report'
        if (data.issueType === 'BI Report') {
            showStatus('Error: "BI Report" is not a valid Issue Type for the SACP system.', true);
            saveEditBtn.disabled = false;
            saveEditBtn.textContent = 'Save Changes';
            return;
        }
    } else {
        // ถ้าไม่ได้เลือก SACP, ให้ลบค่า version ทิ้งไปเลย
         delete data.version;
    }
    // --- ✨ END: จัดการเงื่อนไข ---

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'edit', id: issueId, data: data }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.result === 'success') {
            showStatus('Issue updated successfully!');
            editModal.style.display = 'none';
            loadIssues();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        showStatus(`Error saving changes: ${error.message}`, true);
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.textContent = 'Save Changes';
    }
}

/**
 * จัดการการส่งฟอร์มเพิ่ม Issue ใหม่
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    // --- ✨ START: เพิ่มการตรวจสอบเงื่อนไขสำหรับฟอร์ม Add New ---
    if (data.system === 'SACP') 
    {
        if (!data.version) {
            showStatus('Error: Please select a Version for SACP system.', true);
            submitButton.disabled = false;
            submitButton.textContent = 'Add Issue';
            return;
        }
        if (data.issueType === 'BI Report') {
            showStatus('Error: "BI Report" is not a valid Issue Type for the SACP system.', true);
            submitButton.disabled = false;
            submitButton.textContent = 'Add Issue';
            return;
        }
    } else {
        delete data.version;
    }
    // --- ✨ END: เพิ่มการตรวจสอบเงื่อนไข ---

    const file = imageInput.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            showStatus('Error: File size cannot exceed 5MB.', true);
            submitButton.disabled = false;
            submitButton.textContent = 'Add Issue';
            return;
        }
        data.fileData = await toBase64(file);
        data.fileName = file.name;
        data.mimeType = file.type;
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const result = await response.json();
        if (result.result === 'success') {
            showStatus('Issue added successfully!');
            form.reset();
            showPage('page-view-issues');
            loadIssues();
        } else {
            throw new Error(result.message || 'Unknown error occurred.');
        }
    } catch (error) {
        console.error("Error submitting form:", error);
        showStatus(`Error: ${error.message}`, true);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Add Issue';
    }
}

// --- Event Listeners ---

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    initializeUser(); // เรียกใช้ฟังก์ชันดึงชื่อผู้ใช้

    // --- ✨ START: โค้ดควบคุม Dependent Dropdown ---
    // ส่วนที่ 1: ควบคุมฟอร์ม "Add New Issue"
    const systemSelect = document.getElementById('system-select');
    if (systemSelect) {
        systemSelect.addEventListener('change', function() {
            if (this.value === 'SACP') {
                document.getElementById('version-container').style.display = 'block';
            } else {
                document.getElementById('version-container').style.display = 'none';
            }
            updateIssueTypeOptions(this.value, 'issueType'); // ✨ เรียกใช้ฟังก์ชันใหม่
        });
    }

    // ส่วนที่ 2: ควบคุมฟอร์ม "Edit Modal"
    const editSystemSelect = document.getElementById('editSystemSelect');
    if (editSystemSelect) {
        editSystemSelect.addEventListener('change', function() {
            if (this.value === 'SACP') {
                document.getElementById('editVersionContainer').style.display = 'block';
            } else {
                document.getElementById('editVersionContainer').style.display = 'none';
            }
            updateIssueTypeOptions(this.value, 'editIssueType'); // ✨ เรียกใช้ฟังก์ชันใหม่
        });
    }
    // --- ✨ END: โค้ดควบคุม ---


    // --- โหลดหน้าแรกและข้อมูล (ตัดส่วนที่ซ้ำซ้อนออก) ---
    showPage('page-view-issues'); // แสดงหน้าตารางเป็นหน้าแรก
    loadIssues(); // โหลดข้อมูลมาแสดง
});

form.addEventListener('submit', handleFormSubmit);

issueTableBody.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-btn');
    const deleteButton = event.target.closest('.delete-btn');

    if (editButton) {
        openEditModal(editButton.dataset.id);
    }
    if (deleteButton) {
        confirmDelete(deleteButton.dataset.id);
    }
});

issueTableBody.addEventListener('change', (event) => {
    if (event.target.classList.contains('status-dropdown')) {
        handleStatusUpdate(event.target.dataset.id, event.target.value);
    }
});

// Edit Modal Listeners
editForm.addEventListener('submit', handleEditFormSubmit);
closeEditModalBtn.addEventListener('click', () => editModal.style.display = 'none');

// Delete Modal Listeners
closeDeleteModalBtn.addEventListener('click', closeDeleteDialog);
cancelDeleteBtn.addEventListener('click', closeDeleteDialog);
confirmDeleteBtn.addEventListener('click', handleDelete);

// Navigation Listeners
navView.addEventListener('click', () => showPage('page-view-issues'));
navAdd.addEventListener('click', () => showPage('page-add-issue'));
