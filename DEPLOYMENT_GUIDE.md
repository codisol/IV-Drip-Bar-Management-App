# Deployment Guide (Vercel)

This guide explains how to deploy the IV Drip Bar Management App to Vercel.

## Prerequisites
- A [Vercel Account](https://vercel.com/signup)
- The project code pushed to a Git repository (GitHub, GitLab, or Bitbucket) OR the Vercel CLI installed.

## Option 1: Deploy via Vercel Dashboard (Recommended)
1.  **Push to Git**: Ensure your latest code is committed and pushed to your Git repository.
2.  **Import Project**:
    - Go to your [Vercel Dashboard](https://vercel.com/dashboard).
    - Click **"Add New..."** -> **"Project"**.
    - Import your Git repository.
3.  **Configure Project**:
    - **Framework Preset**: Vercel should automatically detect `Vite`.
    - **Root Directory**: `./` (default)
    - **Build Command**: `npm run build` (default)
    - **Output Directory**: `build` (Important: The project is configured to output to `build`, not `dist`).
    - **Environment Variables**: None required for this app.
4.  **Deploy**: Click **"Deploy"**.

## Option 2: Deploy via Vercel CLI
1.  **Install CLI**: `npm i -g vercel`
2.  **Login**: `vercel login`
3.  **Deploy**: Run `vercel` in the project root.
    - Set up and deploy? [Y]
    - Which scope? [Select your account]
    - Link to existing project? [N]
    - Project name? [iv-drip-bar-app]
    - In which directory? [./]
    - Want to modify these settings? [N] (The `vercel.json` file handles the configuration).
4.  **Production**: Once verified, run `vercel --prod` to deploy to production.

## Verification
After deployment, open the provided URL and verify:
1.  **Loading**: The app loads without errors.
2.  **Persistence**: Data saved in the deployed app will persist in your browser's IndexedDB. Note that data is **local to the browser/device**. It will not sync across different devices unless you implement a cloud backend.
