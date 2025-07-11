// วาง URL ของเว็บแอปที่คุณคัดลอกมาจาก Google Apps Script ตรงนี้
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMxmfo8RYrg0rY3W33AaymHtsNazxj-kaSu0X1ZMHZlkwXgDeRivkVuLhNC6gZpeqP/exec'; 


// --- DOM Elements ---
const form = document.getElementById('issueForm');
const submitButton = document.getElementById('submitButton');
const statusMessage = document.getElementById('status-message');
const issueTableBody = document.getElementById('issueTableBody');
const imageInput = document.getElementById('issueImage');

// --- Functions ---

/**
 * ฟังก์ชันแปลงไฟล์เป็น Base64 string
 * @param {File} file - ไฟล์ที่ต้องการแปลง
 * @returns {Promise<string>}
 */
function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = isError ? 'error' : 'success';
    statusMessage.style.display = 'block';
    setTimeout(() => { statusMessage.style.display = 'none'; }, 4000);
}

async function loadIssues() {
    issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">🔄 Loading issues...</td></tr>`;
    try {
        const response = await fetch(SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const issues = await response.json();
        issueTableBody.innerHTML = ''; 

        if (issues.length === 0) {
            issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No issues found. 🎉</td></tr>`;
            return;
        }

        issues.forEach(issue => {
            const row = document.createElement('tr');
            
            // ส่วนแสดงผลรูปภาพ (เหมือนเดิม)
            // ✨ ส่วนที่แก้ไขแล้ว
            let imageHtml = '';

            // 1. สร้าง HTML ของไอคอนเก็บไว้ในตัวแปร ทำให้โค้ดสะอาดขึ้น
            const iconSpan = `<span style="font-size: 1.6em; display: block; text-align: center;">${issue.icon || '📄'}</span>`;

            // 2. ตรวจสอบว่ามี URL รูปภาพหรือไม่
            if (issue.ImageUrl && issue.ImageUrl.trim() !== '') {
                // 3. ถ้ามี: สร้างแท็กลิงก์ (<a>) ครอบไอคอน
                imageHtml = `<a href="${issue.ImageUrl}" target="_blank" title="คลิกเพื่อดูรูปภาพ">${iconSpan}</a>`;
            } else {
                // 4. ถ้าไม่มี: แสดงแค่ไอคอนอย่างเดียว (ไม่มีลิงก์)
                imageHtml = iconSpan;
            }

            // --- ✨ ส่วนใหม่: สร้าง Dropdown สำหรับ Status ---
            const statusOptions = ['Open', 'In Progress', 'Closed'];

            let statusHtml = `<select class="status-dropdown" data-id="${issue.ID}">`;
            statusOptions.forEach(option => {
                const isSelected = (option === issue.Status) ? 'selected' : '';
                statusHtml += `<option value="${option}" ${isSelected}>${option}</option>`;
            });
            statusHtml += `</select>`;
            // --- จบส่วนใหม่ ---

            row.innerHTML = `
                <td>${imageHtml}</td>
                <td>${issue.RequestBy || ''}</td>
                <td>${issue.Title || ''}</td>
                <td>${issue.Description || ''}</td>
                <td><span class="priority-${issue.Priority}">${issue.Priority || ''}</span></td>
                <td>${statusHtml}</td> <td>${issue.Timestamp || ''}</td>
            `;
            issueTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading issues:", error);
        issueTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Failed to load issues. Please check the console.</td></tr>`;
    }
}

/**
 * จัดการการอัปเดตสถานะเมื่อ Dropdown ถูกเปลี่ยน
 */
async function handleStatusUpdate(event) {
    const selectElement = event.target;
    const issueId = selectElement.dataset.id;
    const newStatus = selectElement.value;

    selectElement.disabled = true; // ปิดปุ่มชั่วคราวกันการกดซ้ำ

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            // ส่งข้อมูลในรูปแบบที่ Apps Script ของเรารู้จัก
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
        loadIssues(); // หากเกิดข้อผิดพลาด ให้โหลดข้อมูลใหม่ทั้งหมด
    } finally {
        selectElement.disabled = false; // เปิดปุ่มให้ใช้งานได้อีกครั้ง
    }
}


// เพิ่ม Event Listener ให้กับตารางเพื่อดักจับการเปลี่ยนแปลงของ status-dropdown
issueTableBody.addEventListener('change', (event) => {
    // เช็กว่า element ที่ถูกเปลี่ยนคือ dropdown ของเราหรือไม่
    if (event.target.classList.contains('status-dropdown')) {
        handleStatusUpdate(event);
    }
});

async function handleFormSubmit(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // --- ส่วนจัดการไฟล์ ---
    const file = imageInput.files[0];
    if (file) {
        // จำกัดขนาดไฟล์ไม่เกิน 5MB (ปรับแก้ได้)
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
    // --- จบส่วนจัดการไฟล์ ---

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

document.addEventListener('DOMContentLoaded', loadIssues);
form.addEventListener('submit', handleFormSubmit);