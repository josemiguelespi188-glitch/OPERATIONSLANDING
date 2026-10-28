-- One-time data seed for request_types.pinned_clickup_fields (added by
-- migration 021), per explicit request (Oct 2026): rather than guess at
-- ClickUp's own per-task "pin" UI state (not exposed via the ClickUp
-- API, and this sandbox cannot reach clickup.com to inspect it anyway),
-- each locked request type's starting "pinned" set is seeded from the
-- exact ClickUp custom field ids that type's own CUSTOM_FIELD_MAP /
-- ATTACHMENT_FIELD_MAP entries in lib/integrations/clickup.ts already
-- confirm it actually submits to -- i.e. "the fields we use frequently"
-- for that form, already verified and already live. This is a starting
-- default only, fully admin-editable afterward from "View More ClickUp
-- Fields" in the Generate Document mapping editor.
--
-- investment-change-name-request and transfer-agreement-request have no
-- CUSTOM_FIELD_MAP entries yet (see CLAUDE.md), so nothing to seed for
-- them -- their pinned_clickup_fields stays at migration 021's default
-- ('[]'). investor-update-request isn't wired into CUSTOM_FIELD_MAP or
-- request_types' ClickUp sync at all and is skipped for the same reason.

update request_types set pinned_clickup_fields = '[
  "c6057eeb-022e-498e-958c-de89c4faf37f",
  "3026a4c9-b01c-41cb-ab92-87b2cf417ba1",
  "0de379f0-b634-44ad-b5cc-ef75f46359ed",
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "70257f39-e3a9-4c45-88bf-e5c5677ccc03",
  "6429a23e-370b-40f8-ac77-f8273b2b7787",
  "a655d17c-0108-470a-8d83-acf2a2abfeea",
  "3d082ed6-621a-4546-bff8-315544c7bc05"
]'::jsonb
where slug = 'title-transfer-request';

update request_types set pinned_clickup_fields = '[
  "3026a4c9-b01c-41cb-ab92-87b2cf417ba1",
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "70257f39-e3a9-4c45-88bf-e5c5677ccc03",
  "d90c8115-3271-4597-89ac-bfac73e77c28",
  "e98c4094-ee91-4886-b1c7-78a0da31d092",
  "be5ab0e3-b125-4f58-ae22-8831e67dc294",
  "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f",
  "6429a23e-370b-40f8-ac77-f8273b2b7787",
  "a655d17c-0108-470a-8d83-acf2a2abfeea",
  "4fdc8130-8d98-4172-8003-7f3e39ff5c5a",
  "3d082ed6-621a-4546-bff8-315544c7bc05"
]'::jsonb
where slug = 'redemption-request';

update request_types set pinned_clickup_fields = '[
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "f2d63342-eb0e-48f8-a930-4c183fa65284",
  "5bbae178-213c-4daf-9af2-becc105f0bbd",
  "70257f39-e3a9-4c45-88bf-e5c5677ccc03",
  "715f4b75-677f-40ab-98e7-42c21bcb4a02",
  "8438e487-dd9b-4cf1-846e-426ee12722ef"
]'::jsonb
where slug = 'ira-funding-request';

update request_types set pinned_clickup_fields = '[
  "6429a23e-370b-40f8-ac77-f8273b2b7787",
  "cbe6e8ba-b3d0-4d15-891a-6135dc0fa5d2",
  "16bbdf7a-3426-45db-bdb2-d027a4e88173",
  "3d082ed6-621a-4546-bff8-315544c7bc05"
]'::jsonb
where slug = 'refund-request';

update request_types set pinned_clickup_fields = '[
  "70257f39-e3a9-4c45-88bf-e5c5677ccc03",
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f",
  "a655d17c-0108-470a-8d83-acf2a2abfeea",
  "c09fee99-4a44-4a86-9850-a882229f1596"
]'::jsonb
where slug = 'side-letter-request';

update request_types set pinned_clickup_fields = '[
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "70257f39-e3a9-4c45-88bf-e5c5677ccc03",
  "49e8aa99-c731-42bd-b27d-dd250eb41f0f",
  "6429a23e-370b-40f8-ac77-f8273b2b7787",
  "a655d17c-0108-470a-8d83-acf2a2abfeea"
]'::jsonb
where slug = 'investor-information-update';

update request_types set pinned_clickup_fields = '[
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f",
  "6429a23e-370b-40f8-ac77-f8273b2b7787",
  "a655d17c-0108-470a-8d83-acf2a2abfeea"
]'::jsonb
where slug = 'account-maintenance-request';

update request_types set pinned_clickup_fields = '[
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "a655d17c-0108-470a-8d83-acf2a2abfeea",
  "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f",
  "86e46ade-ece1-481e-9361-66d905e1cdc3"
]'::jsonb
where slug = 'document-request';

update request_types set pinned_clickup_fields = '[
  "3a84a910-2a20-4c12-984f-d3e89926550a",
  "7ed0cab2-f868-4c7e-814a-94daeb040a60",
  "42b9ef7f-4cde-41d5-b3b1-64d89fd0c88f",
  "a655d17c-0108-470a-8d83-acf2a2abfeea",
  "8c27d365-14a3-4a67-bfb9-f03a442663fd"
]'::jsonb
where slug = 'axiskey-report-request';
