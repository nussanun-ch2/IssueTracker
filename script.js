// วาง URL ของเว็บแอปที่คุณคัดลอกมาจาก Google Apps Script ตรงนี้
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyf9AMDp_grZE4x0ILhVYkLvfSBlI7hay1s-vr0V3zGWTrinyTErqF2GTQcCBKgjGO3/exec';

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

// Delete modal elements
const deleteModal = document.getElementById('deleteModalOverlay');
const closeDeleteModalBtn = document.getElementById('closeDeleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let issueIdToDelete = null;

// --- Functions ---

/**
 * ฟังก์ชันสลับหน้า
 * @param {string} pageId - ID ของหน้าที่ต้องการแสดง
 */
function showPage(pageId) {
    // ซ่อนทุกหน้า
    document.querySelectorAll('.page-section').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));

    // แสดงหน้าที่เลือก
    if (pageId === 'page-add-issue') {
        document.getElementById(pageId).classList.add('active');
        navAdd.classList.add('active');
    } else {
        // หน้าเริ่มต้นคือหน้าดูรายการ
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
    setTimeout(() => { statusMessage.style.display = 'none'; }, 4000);
}

/**
 * โหลดข้อมูล Issues ทั้งหมดมาแสดงในตาราง
 */
async function loadIssues() {
    issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">🔄 Loading issues...</td></tr>`;
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const issues = await response.json();
        
        // ตรวจสอบว่า response เป็น error object หรือไม่
        if (issues.result === 'error') {
            throw new Error(issues.message);
        }

        issueTableBody.innerHTML = ''; 

        if (issues.length === 0) {
            issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No issues found. 🎉</td></tr>`;
            return;
        }

        issues.forEach(issue => {
            const row = document.createElement('tr');
            
            // Icon and Image Link
            let imageHtml = '';
            const iconSpan = `<span style="font-size: 1.6em; display: block; text-align: center;">${issue.icon || '📄'}</span>`;
            if (issue.ImageUrl && issue.ImageUrl.trim() !== '') {
                imageHtml = `<a href="${issue.ImageUrl}" target="_blank" title="คลิกเพื่อดูรูปภาพ">${iconSpan}</a>`;
            } else {
                imageHtml = iconSpan;
            }

            // Status Dropdown
            const statusOptions = ['Open', 'In Progress', 'Closed'];
            let statusHtml = `<select class="status-dropdown" data-id="${issue.ID}">`;
            statusOptions.forEach(option => {
                const isSelected = (option === issue.Status) ? 'selected' : '';
                statusHtml += `<option value="${option}" ${isSelected}>${option}</option>`;
            });
            statusHtml += `</select>`;

            // Action Buttons
            const actionsHtml = `
                <button class="edit-btn" data-id="${issue.ID}" title="Edit">✏️</button>
                <button class="delete-btn" data-id="${issue.ID}" title="Delete">🗑️</button>
            `;

            row.innerHTML = `
                <td>${imageHtml}</td>
                <td>${issue.RequestBy || ''}</td>
                <td>${issue.Title || ''}</td>
                <td><span class="priority-${issue.Priority}">${issue.Priority || ''}</span></td>
                <td>${statusHtml}</td>
                <td>${issue.Timestamp || ''}</td>
                <td>${actionsHtml}</td>
            `;
            issueTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading issues:", error);
        issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Failed to load issues: ${error.message}</td></tr>`;
    }
}

/**
 * จัดการการอัปเดตสถานะ
 */
async function handleStatusUpdate(issueId, newStatus) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ id: issueId, newStatus: newStatus }), 
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
        loadIssues(); // โหลดข้อมูลใหม่หากเกิดข้อผิดพลาด
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
            loadIssues(); // โหลดข้อมูลใหม่
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
 * จัดการการส่งฟอร์มเพิ่ม Issue ใหม่
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

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
            showPage('page-view-issues'); // กลับไปหน้าดูรายการ
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

// โหลดข้อมูลเมื่อหน้าเว็บพร้อมใช้งาน
document.addEventListener('DOMContentLoaded', () => {
    showPage('page-view-issues'); // แสดงหน้าดูรายการเป็นหน้าแรก
    loadIssues();
});

// จัดการการส่งฟอร์ม
form.addEventListener('submit', handleFormSubmit);

// จัดการการคลิกในตาราง (สำหรับปุ่มแก้ไข, ลบ, และ dropdown)
issueTableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (target.classList.contains('delete-btn')) {
        const id = target.dataset.id;
        confirmDelete(id);
    }
    // TODO: Add logic for edit button here
});

issueTableBody.addEventListener('change', (event) => {
    const target = event.target;
    if (target.classList.contains('status-dropdown')) {
        const id = target.dataset.id;
        const newStatus = target.value;
        handleStatusUpdate(id, newStatus);
    }
});

// จัดการการคลิกปุ่มในหน้าต่างยืนยันการลบ
closeDeleteModalBtn.addEventListener('click', closeDeleteDialog);
cancelDeleteBtn.addEventListener('click', closeDeleteDialog);
confirmDeleteBtn.addEventListener('click', handleDelete);

// จัดการการคลิกเมนูนำทาง
navView.addEventListener('click', () => showPage('page-view-issues'));
navAdd.addEventListener('click', () => showPage('page-add-issue'));
