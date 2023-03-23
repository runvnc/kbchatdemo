const chatForm = document.querySelector('.chat-footer');
const chatInput = document.querySelector('.chat-footer input');
const chatBody = document.querySelector('.chat-body');
chatForm.addEventListener('submit', async (e) => {
  console.log('submit')
  e.preventDefault();
  const query = chatInput.value;
  chatInput.value = '';
  const response = await fetch('/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  });
  const data = await response.json();
  const message = `
    <div class="message">
      <p>${query}</p>
    </div>
    <div class="message">
      <p>${data.response}</p>
    </div>
  `;
  chatBody.insertAdjacentHTML('beforeend', message);
  chatBody.scrollTop = chatBody.scrollHeight;
});
