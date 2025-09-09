// --- Constants ---
const SPREADSHEET_ID = '1lsqPjlCos4aZoJqNeHHjNrKOqOiBbfL1c6LdtNQh3lUE'; // Replace with your actual Spreadsheet ID

// User Sheet Constants
const USERS_SHEET_NAME = 'Users';
const USER_ID_COL_INDEX = 0;       // Column A
const USERNAME_COL_INDEX = 1;      // Column B
const PASSWORD_COL_INDEX = 2;      // Column C (Plain text password)
const DISPLAY_NAME_COL_INDEX = 3;  // Column D
const USER_ROLE_COL_INDEX = 4;     // Column E

// Task Sheet Constants (UPDATED FOR NEW COLUMNS)
const TASKS_SHEET_NAME = 'Tasks';
const TASK_ID_COL_INDEX = 0;       // Column A
const TASK_CREATED_BY_USER_ID_COL_INDEX = 1;  // Column B - NEW
const TASK_ASSIGNED_TO_USER_ID_COL_INDEX = 2; // Column C - NEW
const TASK_TITLE_COL_INDEX = 3;    // Column D - SHIFTED
const TASK_DESCRIPTION_COL_INDEX = 4; // Column E - SHIFTED
const TASK_STATUS_COL_INDEX = 5;   // Column F - SHIFTED
const TASK_CREATED_AT_COL_INDEX = 6; // Column G - SHIFTED
const TASK_COMPLETED_AT_COL_INDEX = 7; // Column H - SHIFTED

const HEADER_ROW_COUNT = 1; // Number of header rows to skip

// --- Helper Functions to get Sheets ---
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(sheetName);
}

// --- Web App Entry Point ---
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Task Manager')
    .setFaviconUrl('https://raw.githubusercontent.com/google/material-design-icons/master/png/action/list_black_24dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// --- Include HTML Files (for CSS/JS separation) ---
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

// --- User Authentication (No Hashing) ---
function authenticateUser(username, password) {
  const usersSheet = getSheet(USERS_SHEET_NAME);
  const usersData = usersSheet.getDataRange().getValues();

  if (usersData.length <= HEADER_ROW_COUNT) {
    return null; // No users registered
  }

  for (let i = HEADER_ROW_COUNT; i < usersData.length; i++) {
    const row = usersData[i];
    // DIRECT COMPARISON OF PLAIN TEXT PASSWORD - SECURITY RISK
    if (row[USERNAME_COL_INDEX].toLowerCase() === username.toLowerCase() &&
        row[PASSWORD_COL_INDEX] === password) {
      return {
        userId: row[USER_ID_COL_INDEX],
        username: row[USERNAME_COL_INDEX],
        displayName: row[DISPLAY_NAME_COL_INDEX],
        role: row[USER_ROLE_COL_INDEX]
      };
    }
  }
  return null; // Authentication failed
}

/**
 * Fetches a list of all users (ID, Display Name, Role) for dropdowns and mapping.
 * @returns {Array<Object>} List of user objects {id, displayName, role}.
 */
function getAllUsersForDropdown() {
  const usersSheet = getSheet(USERS_SHEET_NAME);
  const usersData = usersSheet.getDataRange().getValues();

  const userList = [];
  if (usersData.length <= HEADER_ROW_COUNT) {
    return userList;
  }

  for (let i = HEADER_ROW_COUNT; i < usersData.length; i++) {
    const row = usersData[i];
    userList.push({
      id: row[USER_ID_COL_INDEX],
      displayName: row[DISPLAY_NAME_COL_INDEX],
      role: row[USER_ROLE_COL_INDEX]
    });
  }
  return userList;
}

// --- Dashboard Summary ---
function getDashboardSummary(currentUserId, currentUserRole) {
  const tasksSheet = getSheet(TASKS_SHEET_NAME);
  const tasksData = tasksSheet.getDataRange().getValues();

  let totalTasks = 0;
  let toDoTasks = 0;
  let doneTasks = 0;

  if (tasksData.length <= HEADER_ROW_COUNT) {
    return { totalTasks, toDoTasks, doneTasks };
  }

  for (let i = HEADER_ROW_COUNT; i < tasksData.length; i++) {
    const row = tasksData[i];
    const createdBy = row[TASK_CREATED_BY_USER_ID_COL_INDEX] ? row[TASK_CREATED_BY_USER_ID_COL_INDEX].toString() : '';
    const assignedTo = row[TASK_ASSIGNED_TO_USER_ID_COL_INDEX] ? row[TASK_ASSIGNED_TO_USER_ID_COL_INDEX].toString() : '';

    // Admin sees all tasks. Employee sees tasks created by them OR assigned to them.
    if (currentUserRole === 'Admin' ||
        createdBy === currentUserId.toString() ||
        assignedTo === currentUserId.toString()) {
      totalTasks++;
      const status = row[TASK_STATUS_COL_INDEX];
      if (status === 'To Do') {
        toDoTasks++;
      } else if (status === 'Done') {
        doneTasks++;
      }
    }
  }
  return { totalTasks, toDoTasks, doneTasks };
}

// --- Task Management (User-Specific / Admin-Global CRUD) ---

/**
 * Gets tasks based on the user's role:
 * - Admin: All tasks, with creator and assignee info.
 * - Employee: Tasks created by them, and tasks assigned to them.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @param {string} currentUserRole - The role of the currently logged-in user ('Admin' or 'Employee').
 * @returns {Object} An object containing two arrays: { createdTasks: [], assignedTasks: [] } for Employee,
 *                   or { allTasks: [] } for Admin.
 */
function getTasksForUser(currentUserId, currentUserRole) {
  const tasksSheet = getSheet(TASKS_SHEET_NAME);
  const tasksData = tasksSheet.getDataRange().getValues();
  const usersSheet = getSheet(USERS_SHEET_NAME);
  const usersData = usersSheet.getDataRange().getValues();

  const userMap = {}; // To easily get display name by userId
  for (let i = HEADER_ROW_COUNT; i < usersData.length; i++) {
    userMap[usersData[i][USER_ID_COL_INDEX]] = usersData[i][DISPLAY_NAME_COL_INDEX];
  }

  if (tasksData.length <= HEADER_ROW_COUNT) {
    return currentUserRole === 'Admin' ? { allTasks: [] } : { createdTasks: [], assignedTasks: [] };
  }

  const allTasks = [];
  const createdTasks = [];
  const assignedTasks = [];

  for (let i = HEADER_ROW_COUNT; i < tasksData.length; i++) {
    const row = tasksData[i];
    const createdByUserId = row[TASK_CREATED_BY_USER_ID_COL_INDEX] ? row[TASK_CREATED_BY_USER_ID_COL_INDEX].toString() : '';
    const assignedToUserId = row[TASK_ASSIGNED_TO_USER_ID_COL_INDEX] ? row[TASK_ASSIGNED_TO_USER_ID_COL_INDEX].toString() : '';

    const task = {
      id: row[TASK_ID_COL_INDEX],
      createdByUserId: createdByUserId,
      createdByDisplayName: userMap[createdByUserId] || 'Unknown User',
      assignedToUserId: assignedToUserId,
      assignedToDisplayName: userMap[assignedToUserId] || 'Not Assigned',
      title: row[TASK_TITLE_COL_INDEX],
      description: row[TASK_DESCRIPTION_COL_INDEX],
      status: row[TASK_STATUS_COL_INDEX],
      createdAt: row[TASK_CREATED_AT_COL_INDEX],
      completedAt: row[TASK_COMPLETED_AT_COL_INDEX]
    };

    if (currentUserRole === 'Admin') {
      allTasks.push(task);
    } else { // Employee
      if (createdByUserId === currentUserId.toString()) {
        createdTasks.push(task);
      }
      if (assignedToUserId === currentUserId.toString()) {
        assignedTasks.push(task);
      }
    }
  }

  // Sort tasks: To Do first, then Done. Within each, by creation date.
  const sortTasks = (tasks) => tasks.sort((a, b) => {
    if (a.status === 'To Do' && b.status === 'Done') return -1;
    if (a.status === 'Done' && b.status === 'To Do') return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  if (currentUserRole === 'Admin') {
    return { allTasks: sortTasks(allTasks) };
  } else {
    return {
      createdTasks: sortTasks(createdTasks),
      assignedTasks: sortTasks(assignedTasks)
    };
  }
}

/**
 * Adds a new task. Admin can assign to others, Employees assign to themselves.
 * @param {Object} taskData - Object with title and description.
 * @param {string} currentUserId - The ID of the currently logged-in user (creator).
 * @param {string} currentUserRole - The role of the currently logged-in user.
 * @param {string} assignedToId - (Optional for Admin) The UserID to assign the task to.
 * @returns {Object} Updated tasks for the user.
 */
function addTask(taskData, currentUserId, currentUserRole, assignedToId = currentUserId) {
  if (!currentUserId) throw new Error("No user logged in for adding task.");

  const tasksSheet = getSheet(TASKS_SHEET_NAME);
  const newTaskId = Utilities.getUuid(); // Generate unique Task ID
  const createdAt = new Date().toLocaleString();

  // If Employee, they can only assign tasks to themselves.
  // If Admin, they can assign to `assignedToId`, defaulting to themselves if not specified.
  const finalAssignedToId = (currentUserRole === 'Employee') ? currentUserId : assignedToId;

  const newRow = [
    newTaskId,
    currentUserId, // CreatedByUserID
    finalAssignedToId, // AssignedToUserID
    taskData.title,
    taskData.description || '',
    'To Do',
    createdAt,
    '' // Completed At
  ];
  tasksSheet.appendRow(newRow);
  return getTasksForUser(currentUserId, currentUserRole);
}

/**
 * Updates the status of a task.
 * Admin can update any task, Employee can only update tasks they created or are assigned to.
 * @param {string} taskId - The ID of the task to update.
 * @param {string} newStatus - The new status ('To Do' or 'Done').
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @param {string} currentUserRole - The role of the currently logged-in user.
 * @returns {Object} Updated tasks for the user.
 */
function updateTaskStatus(taskId, newStatus, currentUserId, currentUserRole) {
  if (!currentUserId) throw new Error("No user logged in for updating task.");

  const tasksSheet = getSheet(TASKS_SHEET_NAME);
  const data = tasksSheet.getDataRange().getValues();

  for (let i = HEADER_ROW_COUNT; i < data.length; i++) {
    const row = data[i];
    const createdByUserId = row[TASK_CREATED_BY_USER_ID_COL_INDEX].toString();
    const assignedToUserId = row[TASK_ASSIGNED_TO_USER_ID_COL_INDEX].toString();

    // Check if task exists and user has permission
    if (row[TASK_ID_COL_INDEX].toString() === taskId.toString() &&
        (currentUserRole === 'Admin' ||
         createdByUserId === currentUserId.toString() ||
         assignedToUserId === currentUserId.toString())) {
      tasksSheet.getRange(i + 1, TASK_STATUS_COL_INDEX + 1).setValue(newStatus);
      const completedAt = (newStatus === 'Done') ? new Date().toLocaleString() : '';
      tasksSheet.getRange(i + 1, TASK_COMPLETED_AT_COL_INDEX + 1).setValue(completedAt);
      break;
    }
  }
  return getTasksForUser(currentUserId, currentUserRole);
}

/**
 * Deletes a task.
 * Admin can delete any task, Employee can only delete tasks they created or are assigned to.
 * @param {string} taskId - The ID of the task to delete.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @param {string} currentUserRole - The role of the currently logged-in user.
 * @returns {Object} Updated tasks for the user.
 */
function deleteTask(taskId, currentUserId, currentUserRole) {
  if (!currentUserId) throw new Error("No user logged in for deleting task.");

  const tasksSheet = getSheet(TASKS_SHEET_NAME);
  const data = tasksSheet.getDataRange().getValues();

  for (let i = HEADER_ROW_COUNT; i < data.length; i++) {
    const row = data[i];
    const createdByUserId = row[TASK_CREATED_BY_USER_ID_COL_INDEX].toString();
    const assignedToUserId = row[TASK_ASSIGNED_TO_USER_ID_COL_INDEX].toString();

    // Check if task exists and user has permission
    if (row[TASK_ID_COL_INDEX].toString() === taskId.toString() &&
        (currentUserRole === 'Admin' ||
         createdByUserId === currentUserId.toString() ||
         assignedToUserId === currentUserId.toString())) {
      tasksSheet.deleteRow(i + 1);
      break;
    }
  }
  return getTasksForUser(currentUserId, currentUserRole);
}

/**
 * Assigns an existing task to a different user. Only accessible by Admins.
 * @param {string} taskId - The ID of the task to reassign.
 * @param {string} newAssignedToUserId - The UserID of the new assignee.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @param {string} currentUserRole - The role of the currently logged-in user.
 * @returns {Object} Updated tasks for the user.
 */
function assignExistingTask(taskId, newAssignedToUserId, currentUserId, currentUserRole) {
  if (currentUserRole !== 'Admin') {
    throw new Error("Permission denied: Only Admins can reassign tasks.");
  }
  if (!currentUserId) throw new Error("No user logged in for assigning task.");

  const tasksSheet = getSheet(TASKS_SHEET_NAME);
  const data = tasksSheet.getDataRange().getValues();

  for (let i = HEADER_ROW_COUNT; i < data.length; i++) {
    const row = data[i];
    if (row[TASK_ID_COL_INDEX].toString() === taskId.toString()) {
      tasksSheet.getRange(i + 1, TASK_ASSIGNED_TO_USER_ID_COL_INDEX + 1).setValue(newAssignedToUserId);
      break;
    }
  }
  return getTasksForUser(currentUserId, currentUserRole);
}
