// วาง URL ของเว็บแอปที่คุณคัดลอกมาจาก Google Apps Script ตรงนี้
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbza7LnD4vOpMxLzW-_bkymLUavnLdoq6as8241Gvy6CEjM2He1iEDEcICIuBj1LpF9d/exec';

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
 * โหลดข้อมูล Issues ทั้งหมดมาแสดงในตาราง
 */
async function loadIssues() {
    issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">🔄 Loading issues...</td></tr>`;
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const issues = await response.json();
        
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

            const actionsHtml = `
                <div class="action-buttons">
                    <button class="edit-btn" data-id="${issue.ID}" title="Edit">✏️</button>
                    <button class="delete-btn" data-id="${issue.ID}" title="Delete">🗑️</button>
                </div>
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

        document.getElementById('editIssueId').value = issue.ID;
        document.getElementById('editTitle').value = issue.Title;
        document.getElementById('editDescription').value = issue.Description;
        document.getElementById('editPriority').value = issue.Priority;
        document.getElementById('editStatus').value = issue.Status;

        editModal.style.display = 'flex';
    } catch (error) {
        showStatus(`Error opening edit form: ${error.message}`, true);
    }
}

/**
 * จัดการการบันทึกข้อมูลที่แก้ไข
 */
async function handleEditFormSubmit(event) {
    event.preventDefault();
    saveEditBtn.disabled = true;
    saveEditBtn.textContent = 'Saving...';

    const formData = new FormData(editForm);
    const data = {
        Title: formData.get('title'),
        Description: formData.get('description'),
        Priority: formData.get('priority'),
        Status: formData.get('status')
    };
    const issueId = formData.get('id');

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

document.addEventListener('DOMContentLoaded', () => {
    showPage('page-view-issues');
    loadIssues();
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
