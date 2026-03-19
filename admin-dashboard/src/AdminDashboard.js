import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:3000";

export default function AdminDashboard() {
  const [pdfs, setPdfs] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchPdfs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/kb-status`);
      setPdfs(res.data.pdfsLoaded || []);
    } catch (err) {
      setMessage("Failed to load PDFs");
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return setMessage("Select a PDF first");

    setLoading(true);
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await axios.post(`${API_BASE}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(res.data.message);
      setFile(null);
      fetchPdfs();
    } catch (err) {
      setMessage("Upload failed");
    }

    setLoading(false);
  };

  const handleDelete = async (pdfName) => {
    if (!window.confirm(`Delete ${pdfName}?`)) return;

    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/delete-pdf`, { pdfName });
      setMessage(res.data.message);
      fetchPdfs();
    } catch (err) {
      setMessage("Delete failed");
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>📚 Admin PDF Dashboard</h1>

      {message && <p style={styles.message}>{message}</p>}

      <div style={styles.uploadSection}>
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <button onClick={handleUpload} disabled={loading || !file} style={styles.uploadButton}>
          {loading ? "Uploading..." : "Upload PDF"}
        </button>
      </div>

      <div style={styles.pdfList}>
        {pdfs.length === 0 && <p>No PDFs uploaded yet.</p>}

        {pdfs.map((pdf, index) => (
          <div key={index} style={styles.pdfItem}>
            <div>
              <strong>{pdf.name}</strong> — {pdf.words} words, {pdf.chunks} chunks
            </div>

            <button onClick={() => handleDelete(pdf.name)} style={styles.deleteButton}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "2rem",
    background: "linear-gradient(135deg, #006400 0%, #FFD700 60%, #ffffff 100%)",
    fontFamily: "Arial, sans-serif",
  },
  header: {
    textAlign: "center",
    color: "#fff",
    textShadow: "2px 2px #000",
    marginBottom: "2rem",
  },
  message: {
    textAlign: "center",
    color: "#000",
    marginBottom: "1rem",
    fontWeight: "bold",
  },
  uploadSection: {
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "2rem",
  },
  uploadButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#FFD700",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  pdfList: {
    maxWidth: "800px",
    margin: "0 auto",
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: "1rem",
    borderRadius: "10px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
  },
  pdfItem: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.5rem 0",
    borderBottom: "1px solid #ccc",
  },
  deleteButton: {
    backgroundColor: "#FF4500",
    border: "none",
    color: "#fff",
    padding: "0.3rem 0.8rem",
    borderRadius: "5px",
    cursor: "pointer",
  },
};