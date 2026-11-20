# Location Management

Public endpoints expose active provinces, districts, cities/towns, search, and hierarchy under `/api/v1/locations`.

`locations.manage` is required for create and update operations. Parent relationships are validated: districts require provinces and cities/towns require districts.
