'use client';

import { useState, useEffect } from 'react';

export default function LiveMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // GitHub Repository URL বা Raw JSON URL
  // আপনার রিপোজিটরির সঠিক Raw File URL এখানে বসান
  const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/srhady/tapmad-bd/refs/heads/main/tapmad_bd.json';

  const fetchMatchData = async () => {
    try {
      const response = await fetch(GITHUB_JSON_URL, {
        cache: 'no-store' // ক্যাশ বন্ধ রাখতে যাতে সবসময় নতুন ডাটা আসে
      });

      if (!response.ok) {
        throw new Error('ডাটা লোড করতে সমস্যা হয়েছে');
      }

      const data = await response.json();
      setMatches(data.matches || data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data from GitHub:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    // প্রথমবার পেজ লোড হলে ডাটা ফেচ হবে
    fetchMatchData();

    // প্রতি ১০ সেকেন্ড (১০,০০০ মিলিসেকেন্ড) পর পর স্বয়ংক্রিয়ভাবে ডাটা আপডেট হবে
    const interval = setInterval(() => {
      fetchMatchData();
    }, 10000);

    // কম্পোনেন্ট আনমাউন্ট হলে টাইমার ক্লিয়ার করা হবে
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>ডাটা লোড হচ্ছে...</p>;
  if (error) return <p>ত্রুটি: {error}</p>;

  return (
    <div className="match-container">
      <h2>লাইভ ম্যাচ আপডেট</h2>
      <ul>
        {matches.map((match, index) => (
          <li key={match.id || index} className="p-2 border-b">
            <strong>{match.team1}</strong> vs <strong>{match.team2}</strong> - {match.score || match.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
