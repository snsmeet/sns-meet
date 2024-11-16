import dotenv from 'dotenv';
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.YOUR_EMAIL,
    pass: process.env.YOUR_PASSWORD,
  },
});

app.post('/send-email', (req, res) => {
  const { email, code } = req.body;

  const mailOptions = {
    from: process.env.YOUR_EMAIL,
    to: email,
    subject: 'Final HR server mjs - Access Link and Call Code',
    text: `Dear Candidate,

We are pleased to invite you to the next stage of our hiring process—a virtual HR interview. Please review the instructions below to ensure a smooth and successful meeting.

Interview Details:
Link to Join: https://interview-rahuls-projects-13e18543.vercel.app/
Unique Call Code: ${code}
Instructions:
At your scheduled interview time, click the link provided above to open the interview platform.
Enter Your Unique Call Code: You will be prompted to enter your unique code (${code}). This code connects you directly with our HR representative.
Complete Your Setup: Ensure your camera and microphone are enabled to allow for video and audio during the interview.
Please be ready and logged in at the scheduled time. If you encounter any issues connecting, feel free to reach out to us immediately for assistance.

Thank you for your interest and preparation. We look forward to our conversation!

Best regards,
HR TEAM`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).json({ message: 'Failed to send email' });
    } else {
      res.status(200).json({ message: 'Email sent successfully' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
