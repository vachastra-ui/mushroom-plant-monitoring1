# VACHASTRA Monitoring PWA

This is an installable Progressive Web App for iPhone and Android. It reads room data from your existing Google Apps Script / Google Sheets dashboard. It does not require Arduino firmware changes.

## What it includes
- Room cards showing latest CO2, temperature, humidity and last reading time
- Stale/online indication (a reading older than 5 minutes is marked stale)
- Trend charts from the available latest readings
- Recent readings table and CSV export
- Refresh every 30 seconds
- Installable app manifest and service worker

## Step 1 — Update Google Apps Script
1. Open your existing Apps Script project.
2. Open `Code.gs`.
3. Follow `Code.gs_patch.txt` to add the `dashboard` JSONP action.
4. Save and redeploy the existing deployment as a **new version**.
5. Keep the existing `log` action unchanged so Arduino cloud logging continues to work.

The app uses JSONP so it can read data from Apps Script from a separately hosted website without a browser CORS fetch. The Apps Script endpoint must be accessible to the app.

## Step 2 — Host the app on HTTPS
The app must be served over HTTPS to be installable. A simple free option is GitHub Pages.

1. Sign in to GitHub and create a new repository, for example `vachastra-monitor`.
2. Upload all files/folders in this package to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `service-worker.js`
   - `icons/` folder
3. In the repository, open **Settings → Pages**.
4. Under build/deployment, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Wait for GitHub Pages to publish the site. It will provide an HTTPS address similar to `https://YOUR-USERNAME.github.io/vachastra-monitor/`.

## Step 3 — Connect to your Apps Script dashboard
1. Open the GitHub Pages address.
2. Paste the full deployed Google Apps Script web app URL, ending in `/exec`.
3. Tap **Connect dashboard**.
4. Wait for the first readings to load.

If you see a connection error:
- Check that the URL is the deployed web app URL ending in `/exec`.
- Open Apps Script → Deploy → Manage deployments and confirm the deployment is active.
- Confirm the `dashboard` JSONP patch is saved and redeployed.
- Check that the Google Sheet has recent rows and `getDashboardData()` exists.
- Try opening this in a browser, replacing the example URL with your actual one:
  `YOUR_SCRIPT_URL/exec?action=dashboard&callback=test`
  A successful response should begin with `test(` and contain JSON data.
- Remember that a script deployment may take a short time to update.

## Step 4 — Install on iPhone
1. Open the HTTPS GitHub Pages address in **Safari**.
2. Tap the Share icon.
3. Choose **Add to Home Screen**.
4. If offered, enable **Open as Web App**, then tap Add.

## Step 5 — Install on Android
1. Open the HTTPS GitHub Pages address in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.

## Notes and limitations
- The app refreshes cloud data every 30 seconds; Arduino readings are expected about every 2 minutes.
- A room is marked stale when its latest reading is older than 5 minutes.
- This app needs an internet connection to fetch new readings. Its interface files may be cached, but live data cannot update offline.
- The app only displays the readings returned by your existing `getDashboardData()` function (currently expected to return up to 100 readings).
- CSV export downloads the readings currently returned by the backend; it is not an unlimited full-database export.
- This prototype does not include push notifications, account sign-in, or role-based access control.
- If the Apps Script web app is deployed for public access, the data endpoint may be accessible to anyone who has its URL. Do not treat the URL as a security boundary. For confidential data, add proper authentication before sharing.
- The app does not alter the Arduino's IP address or Wi-Fi settings.
