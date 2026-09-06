# Updated Fillout Pre-fill Integration Guide

This guide explains how to dynamically map and pass user data from your website database directly into your fullscreen Fillout form using your **live production embed snippet**.

---

## 1. Architectural Concept: "The Data Bridge"

When you configure your system, the fields map using the following pipeline:
```
Your Web Database ──(via JavaScript)──> URL Parameters ──> Fillout Fields ──> Airtable Columns
```
Because your form fields are already linked to Airtable, any pre-filled value sitting in the form at the moment of submission will seamlessly flow directly into your Airtable base.

---

## 2. Parameter Naming Map

Ensure your Fillout **Form Settings ➔ URL parameters / Hidden fields** dashboard matches these exact lowercase, snake_case keys:

| Website Variable Field | Fillout Parameter Key | Target Form Field Type |
| :--- | :--- | :--- |
| First Name | `first_name` | Text |
| Last Name | `last_name` | Text |
| Email | `email` | Email |
| Slack Username | `slack_username` | Text |
| Slack ID | `slack_id` | Text |
| Address (Line 1) | `address_line_1` | Text |
| Address (Line 2) *Optional* | `address_line_2` | Text |
| Country | `country` | Text |

---

## 3. Production Website Code Implementation

Use this dynamic implementation inspiration to adapt into our version. This version reads your user's session profile, constructs the required JSON string object, injects it into Fillout's `data-fillout-embed-params` handler, and executes an explicit initialization framework check.

```html
<!-- 1. Fullscreen Production Fillout Embed Container with Dynamic Logic -->
<div style="position:fixed;top:0px;left:0px;right:0px;bottom:0px;">
  <div 
    id="dynamic-fillout-form"
    data-fillout-id="gXaU3KEUqCus" 
    data-fillout-embed-type="fullscreen" 
    data-fillout-inherit-parameters 
    data-fillout-domain="forms.hackclub.com"
    style="width:100%;height:100%;"
  ></div>
  
  <!-- 2. Official Fillout Server Script Loader -->
  <script src="https://server.fillout.com/embed/v1/"></script>
</div>

<!-- 3. Your Custom Context Injection Script -->
<script>
  (function() {
    // A. FETCH CURRENT SESSION USER DATA
    // Replace these placeholder strings with your actual site session variables
    // e.g., current_user.firstName, req.user.email, authState.uid, etc.
    const loggedInUser = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      slackUsername: "johndoe_hc",
      slackId: "U12345678",
      address1: "123 Innovation Way",
      address2: "", // Leave blank or omit if the user didn't fill it out
      country: "India"
    };

    // B. MATCH DATA TO THE EXACT PARAMETER KEYS REGISTERED IN FILLOUT
    const filloutMappedParams = {
      "first_name": loggedInUser.firstName,
      "last_name": loggedInUser.lastName,
      "email": loggedInUser.email,
      "slack_username": loggedInUser.slackUsername,
      "slack_id": loggedInUser.slackId,
      "address_line_1": loggedInUser.address1,
      "country": loggedInUser.country
    };

    // C. CONDITIONAL LOGIC FOR OPTIONAL FIELDS
    // Only pass address_line_2 if a valid string value exists in your database
    if (loggedInUser.address2 && loggedInUser.address2.trim() !== "") {
      filloutMappedParams["address_line_2"] = loggedInUser.address2;
    }

    // D. EXPOSE LOGIC: Stringify the payload and inject into Fillout target configuration
    const targetFormElement = document.getElementById("dynamic-fillout-form");
    if (targetFormElement) {
      targetFormElement.setAttribute("data-fillout-embed-params", JSON.stringify(filloutMappedParams));
    }

    // E. EXPLICIT CONTAINER INITIALIZATION FOR POPULATED ATTR HEAD-START
    if (window.FilloutEmbed && typeof window.FilloutEmbed.init === "function") {
      window.FilloutEmbed.init();
    }
  })();
</script>
```

---

## 4. Technical Checklist for Code Translation

When sending this to Claude, follow these rules:
1. **Id Match:** Ensure the script runs *after* or alongside the target DOM element container via the `id="dynamic-fillout-form"` identifier match.
2. **JSON Format:** Do not append parameters manually onto the string if using `data-fillout-embed-params`. The attribute expects a clean stringified valid JSON object (`"{"key":"value"}"`).
3. **Data Overrides:** If a field is flagged as **"Hide field always"** within Fillout's developer settings panel, the parameter data still streams silently downstream directly into Airtable upon confirmation.