/**
 * Create initial admin user in Supabase
 * Run with: node scripts/create_user.js
 */

const SUPABASE_URL = "https://evhwlybmnimzdepnlqrn.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Set SUPABASE_SERVICE_KEY environment variable");
  process.exit(1);
}

const USER_EMAIL = "julgarcia@mojito360.com";
const USER_PASSWORD = "Mojito360Admin!"; // Temporary password - user should change
const USER_FULL_NAME = "Julio García";
const USER_ROLE = "admin";

async function createUser() {
  // Create user in auth.users
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: USER_EMAIL,
      password: USER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: USER_FULL_NAME,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Error creating user:", data);
    return;
  }

  console.log("User created:", data.id);

  // Update profile with role
  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        full_name: USER_FULL_NAME,
        role: USER_ROLE,
      }),
    },
  );

  if (profileResponse.ok) {
    console.log("Profile updated with admin role");
    console.log("\n=================================");
    console.log("User created successfully!");
    console.log("Email:", USER_EMAIL);
    console.log("Password:", USER_PASSWORD);
    console.log("Role:", USER_ROLE);
    console.log("=================================");
  } else {
    console.error("Error updating profile:", await profileResponse.text());
  }
}

createUser().catch(console.error);
