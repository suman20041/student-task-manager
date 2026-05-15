# 📖 Project Instructions & File Breakdown

This document provides a clear understanding of the project structure and the working principles of each file.

## 🗂️ File Structure & Working Principles

### 1. `index.html` 🏠
- **Principle**: The entry point of the application.
- **Working**: Defines the semantic skeleton of the app. It houses the task input form, the dynamic task list container, and the icon-only theme picker. It also links the external CSS and JS files.

### 2. `style.css` 🎨
- **Principle**: The visual engine and design system.
- **Working**: Uses CSS Variables (`--bg-color`, `--text-color`, etc.) to implement a flexible multi-theme system. It handles the responsive layout, modern button styling, and the sleek horizontal theme picker UI.

### 3. `script.js` ⚙️
- **Principle**: The logic and data controller.
- **Working**: 
  - **Task Management**: Handles adding, editing, and deleting tasks.
  - **Persistence**: Automatically syncs the task list to `localStorage` so data isn't lost on refresh.
  - **Theme Switching**: Manages the state of the theme picker and applies the selected theme across the entire application.
  - **Stats & Feedback**: Calculates task completion ratios and triggers the celebration animation.

### 4. `privacy.html` 🛡️
- **Principle**: User data transparency.
- **Working**: A simple, accessible document that informs users that their data is stored strictly on their own device (Local Storage) and is never transmitted to any servers.

### 5. `terms.html` 📄
- **Principle**: Usage guidelines.
- **Working**: Outlines the terms of service for using the study tracker, ensuring users understand it is a tool for personal educational use.

## 💡 How to Modify
- **To add a new theme**: Define new color variables in `style.css` under a `[data-theme="new-name"]` block and add a corresponding button in `index.html`.
- **To change icons**: Update the Material Symbol names in `index.html` or `script.js`.

---
*Stay focused and keep building! 🚀*
