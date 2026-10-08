# Library API Design

A REST API for a library's `books` resource. A book has these fields:

- `id` (number, assigned by the server)
- `title` (string)
- `author` (string)
- `year` (number)

## Endpoints

### List all books

- **Method:** GET
- **Path:** `/books`
- **Description:** Returns every book in the library.
- **Request body:** none
- **Success status:** 200 OK

### Get one book

- **Method:** GET
- **Path:** `/books/42`
- **Description:** Returns the book with id 42.
- **Request body:** none
- **Success status:** 200 OK

### Create a book

- **Method:** POST
- **Path:** `/books`
- **Description:** Adds a new book. The server assigns the id.
- **Request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1958
}
```

- **Success status:** 201 Created

### Update a book

- **Method:** PATCH
- **Path:** `/books/42`
- **Description:** Changes only the fields sent for book 42.
- **Request body:**

```json
{
  "year": 1959
}
```

- **Success status:** 200 OK

### Delete a book

- **Method:** DELETE
- **Path:** `/books/42`
- **Description:** Removes book 42.
- **Request body:** none
- **Success status:** 204 No Content

### List books by an author

- **Method:** GET
- **Path:** `/books?author=Chinua%20Achebe`
- **Description:** Returns only the books written by the given author, using the `author` query parameter.
- **Request body:** none
- **Success status:** 200 OK

## Error codes

### 400 Bad Request

- The request is invalid.
- **Example:** `POST /books` with an empty `title`, or with a `year` that is not a number.

### 404 Not Found

- The book or URL does not exist.
- **Example:** `GET /books/9999` when no book has id 9999.