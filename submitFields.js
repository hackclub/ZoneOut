// identity, held from the login itself
export const IDENTITY_FIELDS = ["first_name", "last_name", "email", "slack_id"];

// captured from a submission, sealed, and prefilled next time
export const CAPTURED_FIELDS = {
    address_line_1: 200,
    address_line_2: 200,
    city: 120,
    state: 120,
    zip_code: 32,
    country: 80,
    slack_username: 64,
    github_username: 64,
    birthday: 32
};

// derived from the project the form was opened from, never captured
export const PROJECT_FIELDS = {
    project_description: 1500,
    code_url: 500,
    demo_url: 500
};

// every attribute the mount is allowed to carry
export const PREFILL_KEYS = [
    ...IDENTITY_FIELDS,
    ...Object.keys(CAPTURED_FIELDS),
    ...Object.keys(PROJECT_FIELDS),
    "zo_ref"
];

// the sealed payload ceiling
export const PROFILE_MAX = 2500;
