/**
 * Helper tool for the Administrator (You)
 * Use this to find the correct IDs for config.js
 */
async function discoverIds() {
  if (!isAuthenticated()) {
    console.error("❌ Devi prima fare il login!");
    alert("Effettua prima il login con il tuo account admin!");
    return;
  }

  const client = getGraphClient();
  const folderName = "CMP GVNG"; // Nome cartella che mi hai dato

  console.log(`🔍 Cerco la cartella "${folderName}"...`);
  showToast(`🔍 Cerco la cartella "${folderName}"...`, "info");

  try {
    // 1. Get My Drive ID
    const drive = await client.api("/me/drive").get();
    const driveId = drive.id;
    console.log("✅ Tuo Drive ID:", driveId);

    // 2. Search for the folder
    const search = await client
      .api(`/me/drive/root/children`)
      .filter(`name eq '${folderName}'`)
      .get();

    if (search.value && search.value.length > 0) {
      const folder = search.value[0];
      const folderId = folder.id;

      const message = `
🎉 TROVATO! Ecco i dati da mettere in js/config.js:

driveId: '${driveId}',
folderId: '${folderId}',
            `;

      console.log(message);
      alert(message);
    } else {
      console.error("❌ Cartella non trovata nella root del tuo OneDrive.");
      alert(
        `Impossibile trovare la cartella "${folderName}" nella root del tuo OneDrive. Sei sicuro che il nome sia esatto?`
      );
    }
  } catch (error) {
    console.error("❌ Errore durante la ricerca:", error);
    alert("Errore API: " + error.message);
  }
}

// Expose to window
window.discoverIds = discoverIds;
