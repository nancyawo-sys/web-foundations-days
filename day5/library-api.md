# Library API Design

This is a REST API design for a library's `books` resource. Paths use a plural noun, and the HTTP method says what to do.

## Endpoints

### 1. List all books
- **Method:** GET
- **Path:** `/books`
- **Description:** Returns a list of all books in the library.
- **Request body:** none
- **Success status:** 200 OK

### 2. Get one book
- **Method:** GET
- **Path:** `/books/{id}`
- **Description:** Returns the book with the given id.
- **Request body:** none
- **Success status:** 200 OK

### 3. Create a book
- **Method:** POST
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Request body:**
```json
  { "title": "Things Fall Apart", "author": "Chinua Achebe", "year": 1958 }
```
- **Success status:** 201 Created

### 4. Update a book (partly)
- **Method:** PATCH
- **Path:** `/books/{id}`
- **Description:** Changes some fields of an existing book.
- **Request body:**
```json
  { "year": 1959 }
```
- **Success status:** 200 OK

### 5. Replace a book
- **Method:** PUT
- **Path:** `/books/{id}`
- **Description:** Replaces the whole book with a new version.
- **Request body:**
```json
  { "title": "Things Fall Apart", "author": "Chinua Achebe", "year": 1958 }
```
- **Success status:** 200 OK

### 6. Delete a book
- **Method:** DELETE
- **Path:** `/books/{id}`
- **Description:** Removes the book with the given id.
- **Request body:** none
- **Success status:** 204 No Content

### 7. List books by an author
- **Method:** GET
- **Path:** `/books?author=Chinua%20Achebe`
- **Description:** Returns only the books written by the given author, using a query parameter.
- **Request body:** none
- **Success status:** 200 OK

## Error codes

- **400 Bad Request:** the request is invalid. Example: `POST /books` with an empty title, or a `year` that is text instead of a number.
- **404 Not Found:** the book does not exist. Example: `GET /books/9999` when no book has that id.
