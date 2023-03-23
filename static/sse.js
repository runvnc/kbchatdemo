//const chatBody = document.querySelector('.chat-body');
const eventSource = new EventSource('/query');
eventSource.addEventListener('message', (e) => {
  const data = JSON.parse(e.data);
  const message = `
    <div class="message">
      <p>${data.query}</p>
    </div>
    <div class="message">
      <p>${data.response}</p>
    </div>
  `;
  chatBody.insertAdjacentHTML('beforeend', message);
  chatBody.scrollTop = chatBody.scrollHeight;
});
