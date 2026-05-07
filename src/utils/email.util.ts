import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'SocialMine <onboarding@resend.dev>';

export const sendVerificationEmail = async (email: string, token: string) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your SocialMine account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0e27; color: white; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #00d4ff; font-size: 28px;">⛏️ SocialMine</h1>
        </div>
        <h2 style="color: white; text-align: center;">Verify Your Email</h2>
        <p style="color: #999; text-align: center; font-size: 16px;">
          Thanks for signing up! Click the button below to verify your email address.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background: linear-gradient(135deg, #00d4ff, #667eea); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p style="color: #666; text-align: center; font-size: 13px;">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
        <p style="color: #444; text-align: center; font-size: 11px; margin-top: 30px;">
          Or copy this link: ${verifyUrl}
        </p>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your SocialMine password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0e27; color: white; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #00d4ff; font-size: 28px;">⛏️ SocialMine</h1>
        </div>
        <h2 style="color: white; text-align: center;">Reset Your Password</h2>
        <p style="color: #999; text-align: center; font-size: 16px;">
          We received a request to reset your password. Click the button below to set a new one.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #ff4757, #ff6b81); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; text-align: center; font-size: 13px;">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
        <p style="color: #444; text-align: center; font-size: 11px; margin-top: 30px;">
          Or copy this link: ${resetUrl}
        </p>
      </div>
    `,
  });
};