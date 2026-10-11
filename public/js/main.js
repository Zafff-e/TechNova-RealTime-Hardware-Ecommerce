$(document).ready(function () {

  // theme toggle
  const isDark = document.documentElement.classList.contains('dark-theme');
  $('#theme-toggle').text(isDark ? '☀️' : '🌙');

  $('#theme-toggle').on('click', function () {
    const isCurrentlyDark = document.documentElement.classList.contains('dark-theme');
    if (isCurrentlyDark) {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
      $(this).text('🌙');
    } else {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
      $(this).text('☀️');
    }
  });

  // ws connection
  const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  let socket;

  function connectWS() {
    socket = new WebSocket(wsProtocol + window.location.host);

    socket.onopen = () => {
      console.log('Connected to TechNova real-time server.');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWSMessage(data);
      } catch (e) { }
    };

    socket.onclose = () => {
      console.log('Disconnected. Reconnecting in 3s...');
      setTimeout(connectWS, 3000);
    };

    socket.onerror = () => socket.close();
  }

  connectWS();

  function handleWSMessage(data) {
    switch (data.type) {
      case 'VIEWER_COUNT':
        $('#viewer-count').text(data.count);
        $('#viewer-pill').show();
        break;

      case 'REFRESH_DATA':
        if (!$('.admin-main').length) {
          showToast('Catalog updated! Refreshing...', 'info');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast('Product inventory updated.', 'success');
        }
        break;

      case 'NEW_ORDER':
        if ($('.admin-main').length) {
          showToast(`🛒 New order #${data.orderId} — BDT ${data.amount?.toFixed(2)}`, 'success');
          flashAdminBadge();
        }
        break;

      case 'ORDER_STATUS_UPDATE':
        const myUserId = $('body').data('user-id');
        if (data.customerId === myUserId) {
          showToast(`📦 Your order status updated: ${data.status}`, 'success');
          updateOrderStatusUI(data.orderId, data.status);
        }
        break;

      case 'CHAT_MSG':
        appendChatBubble(data);
        break;
    }
  }

  // toast notification
  function showToast(message, type = 'info') {
    const toast = $(`<div class="toast ${type}">${message}</div>`);
    $('#toast-container').append(toast);
    setTimeout(() => toast.fadeOut(400, function () { $(this).remove(); }), 4000);
  }

  window.showToast = showToast;

  // ajax cart adding
  $(document).on('submit', '.ajax-cart-form', function (e) {
    e.preventDefault();
    const $form = $(this);
    const $btn  = $form.find('.btn-add-cart');

    $btn.prop('disabled', true).html('<span>Adding...</span>');

    $.ajax({
      url: '/cart/add',
      method: 'POST',
      data: $form.serialize(),
      headers: { 'Accept': 'application/json' }
    })
    .done(function (res) {
      if (res.success) {
        const $badge = $('.cart-badge');
        $badge.text(res.cartCount);
        if (res.cartCount > 0) $badge.show(); else $badge.hide();

        $btn.html('<span>✓ Added!</span>').addClass('btn-added');
        setTimeout(() => {
          $btn.prop('disabled', false)
            .html('<span>🛒 Add to Cart</span>')
            .removeClass('btn-added');
        }, 1500);
      }
    })
    .fail(function (xhr) {
      if (xhr.status === 0 || xhr.status === 302) {
        window.location.href = '/login';
      } else {
        showToast('Failed to add item. Please try again.', 'error');
        $btn.prop('disabled', false).html('<span>🛒 Add to Cart</span>');
      }
    });
  });

  // initial cart badge fetch
  $.get('/cart/count', function (data) {
    const count = data.count || 0;
    const $badge = $('.cart-badge');
    $badge.text(count);
    if (count > 0) $badge.css('display', 'flex'); else $badge.hide();
  });

  // otp field inputs
  $('.otp-digit').on('input', function () {
    const val = $(this).val();
    if (val.length >= 1) {
      $(this).next('.otp-digit').focus();
    }
    let otp = '';
    $('.otp-digit').each(function () { otp += $(this).val(); });
    $('#otp-hidden').val(otp);
  });

  $('.otp-digit').on('keydown', function (e) {
    if (e.key === 'Backspace' && !$(this).val()) {
      $(this).prev('.otp-digit').focus();
    }
  });

  $('.otp-digit:first').on('paste', function (e) {
    e.preventDefault();
    const pasted = (e.originalEvent.clipboardData || window.clipboardData).getData('text');
    const digits = pasted.replace(/\D/g, '').split('');
    $('.otp-digit').each(function (i) {
      if (digits[i]) $(this).val(digits[i]);
    });
    let otp = '';
    $('.otp-digit').each(function () { otp += $(this).val(); });
    $('#otp-hidden').val(otp);
    $('.otp-digit').last().focus();
  });

  // product detail gallery
  $(document).on('click', '.thumb-img', function () {
    const src = $(this).data('src');
    $('#main-product-img').attr('src', src);
    $('.thumb-img').removeClass('active');
    $(this).addClass('active');
  });

  // category tab tabs
  $('.cat-tab').on('click', function (e) {
    const href = $(this).attr('href');
    if (href) return;
    e.preventDefault();
    $(this).closest('.category-tabs').find('.cat-tab').removeClass('active');
    $(this).addClass('active');
  });

  // order status updates UI
  function updateOrderStatusUI(orderId, newStatus) {
    const $row = $(`[data-order-id="${orderId}"]`);
    if ($row.length) {
      const statusClass = getStatusClass(newStatus);
      $row.find('.status-badge').attr('class', `status-badge ${statusClass}`).text(newStatus);
    }
  }

  function getStatusClass(status) {
    const map = {
      'Order Placed':      'status-placed',
      'Packaging':         'status-packaging',
      'Dispatched':        'status-dispatched',
      'Out for Delivery':  'status-out',
      'Delivered':         'status-delivered',
      'Cancelled':         'status-cancelled'
    };
    return map[status] || 'status-placed';
  }

  // admin order badge pulse
  function flashAdminBadge() {
    $('#admin-new-order-indicator').show().addClass('pulse');
    setTimeout(() => $('#admin-new-order-indicator').removeClass('pulse'), 3000);
  }

  // admin order status update dropdown
  $(document).on('change', '.order-status-select', function () {
    const $select = $(this);
    const orderId = $select.data('order-id');
    const newStatus = $select.val();

    if (!confirm(`Update order to "${newStatus}"?`)) {
      $select.val($select.data('original'));
      return;
    }

    $.post('/admin/orders/update-status', {
      orderId: orderId,
      status: newStatus,
      note: 'Updated via admin quick-select'
    })
    .done(function () {
      showToast(`Order status updated to "${newStatus}"`, 'success');
      $select.data('original', newStatus);
    })
    .fail(function () {
      showToast('Failed to update status.', 'error');
      $select.val($select.data('original'));
    });
  });

  // live customer chat
  let chatOpen = false;
  let chatIdentity = localStorage.getItem('tn_chat_name') || '';
  let unreadChat = 0;

  if (chatIdentity) {
    $('#chat-name-input').val(chatIdentity).prop('disabled', true);
    $('#chat-set-btn').text('Edit');
    $('#chat-msg-input').prop('disabled', false);
  }

  $('#chat-fab').on('click', function () {
    chatOpen = !chatOpen;
    const $win = $('#chat-window');
    if (chatOpen) {
      $win.css('display', 'flex');
      unreadChat = 0;
      $('#chat-unread').hide().text('0');
      scrollChatToBottom();
    } else {
      $win.hide();
    }
  });

  $('#chat-close').on('click', function () {
    chatOpen = false;
    $('#chat-window').hide();
  });

  $('#chat-set-btn').on('click', function () {
    const $input = $('#chat-name-input');
    const $msgInput = $('#chat-msg-input');
    if ($input.prop('disabled')) {
      $input.prop('disabled', false);
      $msgInput.prop('disabled', true);
      $(this).text('Set');
    } else {
      const name = $input.val().trim();
      if (!name) return showToast('Please enter your nickname.', 'error');
      chatIdentity = name;
      localStorage.setItem('tn_chat_name', name);
      $input.prop('disabled', true);
      $msgInput.prop('disabled', false);
      $(this).text('Edit');
    }
  });

  $('#chat-msg-input').on('keypress', function (e) {
    if (e.key === 'Enter') sendChatMessage();
  });
  $('#chat-send-btn').on('click', sendChatMessage);

  function sendChatMessage() {
    const msg = $('#chat-msg-input').val().trim();
    if (!msg || !chatIdentity || !socket || socket.readyState !== 1) return;
    socket.send(JSON.stringify({ type: 'CHAT_MSG', sender: chatIdentity, message: msg }));
    $('#chat-msg-input').val('');
  }

  function appendChatBubble(data) {
    const isMe = data.sender === chatIdentity;
    const $stream = $('#chat-messages');
    const bubble = `
      <div class="chat-bubble-wrap" style="align-items: ${isMe ? 'flex-end' : 'flex-start'}">
        <div class="chat-meta">${data.sender} &bull; ${data.timestamp}</div>
        <div class="chat-bubble ${isMe ? 'me' : 'them'}">${data.message}</div>
      </div>`;
    $stream.append(bubble);
    scrollChatToBottom();
    if (!chatOpen) {
      unreadChat++;
      $('#chat-unread').text(unreadChat).css('display', 'flex').show();
    }
  }

  function scrollChatToBottom() {
    const el = document.getElementById('chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  // cart quantity buttons
  $(document).on('click', '.qty-btn', function () {
    const $row = $(this).closest('.cart-item-row');
    const $input = $row.find('.qty-value');
    let val = parseInt($input.text()) || 1;
    if ($(this).hasClass('qty-minus')) val = Math.max(1, val - 1);
    if ($(this).hasClass('qty-plus'))  val = val + 1;
    $input.text(val);
    $row.find('.qty-hidden').val(val);
  });

  // admin product modal toggle
  $('#btn-add-product').on('click', function () {
    $('#product-modal').fadeIn(200);
  });
  $(document).on('click', '.edit-product-btn', function () {
    const data = $(this).data();
    $('#edit-product-id').val(data.id);
    $('#edit-product-name').val(data.name);
    $('#edit-product-price').val(data.price);
    $('#edit-product-stock').val(data.stock);
    $('#edit-product-category').val(data.category);
    $('#edit-product-brand').val(data.brand);
    $('#edit-product-desc').val(data.description);
    $('#edit-preorder').prop('checked', data.ispreorder === 'true');
    $('#edit-featured').prop('checked', data.isfeatured === 'true');
    $('#edit-product-modal').fadeIn(200);
  });
  $(document).on('click', '.modal-overlay, .modal-close', function () {
    $('.modal-overlay').fadeOut(200);
  });

  // currency format helpers
  window.formatBDT = (amount) => 'BDT ' + parseFloat(amount).toLocaleString('en-BD', { minimumFractionDigits: 2 });

  // slide in cart drawer logic
  let cartDrawerOpen = false;
  let cartAutoCloseTimer = null;
  let cartHovered = false;

  $('#cart-drawer').on('mouseenter', function () {
    cartHovered = true;
    clearTimeout(cartAutoCloseTimer);
  }).on('mouseleave', function () {
    cartHovered = false;
    cartAutoCloseTimer = setTimeout(() => {
      closeCartDrawer();
    }, 4500);
  });

  function openCartDrawer(autoClose) {
    cartDrawerOpen = true;
    $('#cart-drawer').addClass('open');
    loadCartDrawerItems();

    clearTimeout(cartAutoCloseTimer);
    if (autoClose) {
      cartAutoCloseTimer = setTimeout(() => {
        if (!cartHovered) {
          closeCartDrawer();
        }
      }, 4500);
    }
  }

  function closeCartDrawer() {
    cartDrawerOpen = false;
    clearTimeout(cartAutoCloseTimer);
    $('#cart-drawer').removeClass('open');
    $('#cart-overlay').removeClass('active');
    $('body').css('overflow', '');
  }

  $('#floating-cart-icon').on('click', function () {
    if (cartDrawerOpen) {
      closeCartDrawer();
    } else {
      openCartDrawer(false);
    }
  });

  $('#cart-btn').on('click', function (e) {
    e.preventDefault();
    openCartDrawer(false);
  });

  $('#cart-drawer-close').on('click', closeCartDrawer);

  $('#cart-drawer-minimize').on('click', closeCartDrawer);

  $('#cart-overlay').on('click', closeCartDrawer);

  $(document).on('keydown', function (e) {
    if (e.key === 'Escape' && cartDrawerOpen) closeCartDrawer();
  });

  function loadCartDrawerItems() {
    $.getJSON('/cart/items', function (data) {
      renderCartDrawer(data);
    }).fail(function () {
      renderCartDrawer({ cart: [], subtotal: 0, count: 0 });
    });
  }

  function renderCartDrawer(data) {
    const $items = $('#cart-drawer-items');
    const $footer = $('#cart-drawer-footer');
    const $empty = $('#cart-drawer-empty');

    updateAllBadges(data.count);

    if (data.count > 0) {
      $('#cart-drawer-count').text('(' + data.count + ' items)');
    } else {
      $('#cart-drawer-count').text('');
    }

    if (!data.cart || data.cart.length === 0) {
      $items.find('.cart-drawer-item').remove();
      $empty.show();
      $footer.hide();
      return;
    }

    $empty.hide();
    $footer.show();

    const userId = $('body').data('user-id');
    $('#cart-drawer-checkout-btn').show();
    $('#cart-drawer-auth-btns').hide();

    let html = '';
    data.cart.forEach(function (item) {
      const lineTotal = (item.price * item.quantity).toLocaleString('en-BD');
      let priceHtml = `BDT ${lineTotal}`;
      let discountHtml = '';

      if (item.originalPrice && item.originalPrice > item.price) {
        const lineOriginal = (item.originalPrice * item.quantity).toLocaleString('en-BD');
        const savings = ((item.originalPrice - item.price) * item.quantity).toLocaleString('en-BD');
        priceHtml = `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.8rem; margin-right: 6px;">BDT ${lineOriginal}</span><span style="color: var(--accent-light);">BDT ${lineTotal}</span>`;
        discountHtml = `<div style="color: var(--green); font-size: 0.75rem; font-weight: 600; margin-top: 2px;">Save BDT ${savings}!</div>`;
      }

      const imgPath = item.imagePath || '/images/placeholder.png';

      html += `
        <div class="cart-drawer-item" data-product-id="${item.productId}">
          <img src="${imgPath}" alt="${item.name}" class="cart-drawer-item-img">
          <div class="cart-drawer-item-info">
            <div class="cart-drawer-item-name">${item.name}</div>
            <div class="cart-drawer-item-price">${priceHtml}</div>
            ${discountHtml}
          </div>
          <div class="cart-drawer-item-controls">
            <button class="cart-drawer-qty-btn drawer-qty-minus" data-id="${item.productId}">−</button>
            <span class="cart-drawer-qty-val">${item.quantity}</span>
            <button class="cart-drawer-qty-btn drawer-qty-plus" data-id="${item.productId}">+</button>
            <button class="cart-drawer-remove-btn drawer-remove-item" data-id="${item.productId}" title="Remove">🗑</button>
          </div>
        </div>`;
    });

    $items.find('.cart-drawer-item').remove();
    $items.prepend(html);

    $('#cart-drawer-subtotal-val').text('BDT ' + data.subtotal.toLocaleString('en-BD'));
  }

  function updateAllBadges(count) {
    const $navBadge = $('.cart-badge');
    $navBadge.text(count);
    if (count > 0) $navBadge.css('display', 'flex'); else $navBadge.hide();

    const $floatBadge = $('#floating-cart-badge');
    $floatBadge.text(count);
    if (count > 0) $floatBadge.css('display', 'flex'); else $floatBadge.hide();
  }

  $(document).on('click', '.drawer-qty-minus', function () {
    const productId = $(this).data('id');
    const $row = $(this).closest('.cart-drawer-item');
    $(this).prop('disabled', true);

    $.ajax({
      url: '/cart/remove',
      method: 'POST',
      data: { productId: productId },
      headers: { 'Accept': 'application/json' }
    }).done(function (res) {
      if (res.success) {
        renderCartDrawer(res);
      }
    }).fail(function () {
      showToast('Please login to manage cart.', 'error');
    }).always(function () {
      $row.find('.drawer-qty-minus').prop('disabled', false);
    });
  });

  $(document).on('click', '.drawer-qty-plus', function () {
    const productId = $(this).data('id');
    const $row = $(this).closest('.cart-drawer-item');
    $(this).prop('disabled', true);

    $.ajax({
      url: '/cart/add',
      method: 'POST',
      data: { productId: productId },
      headers: { 'Accept': 'application/json' }
    }).done(function (res) {
      if (res.success) {
        loadCartDrawerItems();
        updateAllBadges(res.cartCount);
      }
    }).fail(function () {
      showToast('Failed to update quantity.', 'error');
    }).always(function () {
      $row.find('.drawer-qty-plus').prop('disabled', false);
    });
  });

  $(document).on('click', '.drawer-remove-item', function () {
    const productId = $(this).data('id');
    const $row = $(this).closest('.cart-drawer-item');

    $row.css({ opacity: 0.4, pointerEvents: 'none' });

    $.ajax({
      url: '/cart/remove-all',
      method: 'POST',
      data: { productId: productId },
      headers: { 'Accept': 'application/json' }
    }).done(function (res) {
      if (res.success) {
        $row.slideUp(200, function () {
          $(this).remove();
          renderCartDrawer(res);
        });
        showToast('Item removed from cart.', 'info');
      }
    }).fail(function () {
      $row.css({ opacity: 1, pointerEvents: '' });
      showToast('Please login to manage cart.', 'error');
    });
  });

  $(document).off('submit', '.ajax-cart-form').on('submit', '.ajax-cart-form', function (e) {
    e.preventDefault();
    const $form = $(this);
    const $btn  = $form.find('.btn-add-cart');

    $btn.prop('disabled', true).html('<span>Adding...</span>');

    $.ajax({
      url: '/cart/add',
      method: 'POST',
      data: $form.serialize(),
      headers: { 'Accept': 'application/json' }
    })
    .done(function (res) {
      if (res.success) {
        updateAllBadges(res.cartCount);

        $btn.html('<span>✓ Added!</span>').addClass('btn-added');
        setTimeout(() => {
          $btn.prop('disabled', false)
            .html('<span>🛒 Add to Cart</span>')
            .removeClass('btn-added');
        }, 1500);

        openCartDrawer(true);
      }
    })
    .fail(function (xhr) {
      if (xhr.status === 0 || xhr.status === 302) {
        window.location.href = '/login';
      } else {
        showToast('Failed to add item. Please try again.', 'error');
        $btn.prop('disabled', false).html('<span>🛒 Add to Cart</span>');
      }
    });
  });

  $.getJSON('/cart/count', function (data) {
    updateAllBadges(data.count || 0);
  });

  // homepage slideshow
  const $slides = $('.slide');
  const $dots = $('.dot');
  let slideIndex = 0;
  let slideshowTimeout = null;

  function showSlide(index) {
    if ($slides.length === 0) return;
    
    if (index >= $slides.length) {
      slideIndex = 0;
    } else if (index < 0) {
      slideIndex = $slides.length - 1;
    } else {
      slideIndex = index;
    }

    $slides.removeClass('active').fadeOut(300);
    $slides.eq(slideIndex).fadeIn(300).addClass('active');

    if ($dots.length > 0) {
      $dots.removeClass('active');
      $dots.eq(slideIndex).addClass('active');
    }
  }

  function autoSlideshow() {
    showSlide(slideIndex + 1);
    slideshowTimeout = setTimeout(autoSlideshow, 3500);
  }

  if ($slides.length > 0) {
    $slides.hide().eq(0).show().addClass('active');
    slideshowTimeout = setTimeout(autoSlideshow, 3500);

    $dots.on('click', function () {
      clearTimeout(slideshowTimeout);
      const clickedIndex = $(this).index();
      showSlide(clickedIndex);
      slideshowTimeout = setTimeout(autoSlideshow, 3500);
    });
  }

  // products filter logic
  function liveFilterProducts(query) {
    const cleanQuery = query.toLowerCase().trim();
    const $cards = $('.products-grid .product-card');

    if ($cards.length === 0) return;

    if (cleanQuery === '') {
      $cards.fadeIn(200);
      return;
    }

    $cards.each(function () {
      const name = $(this).find('.product-name').text().toLowerCase();
      const category = $(this).find('.product-category').text().toLowerCase();
      const matches = name.indexOf(cleanQuery) > -1 || category.indexOf(cleanQuery) > -1;

      if (matches) {
        $(this).fadeIn(200);
      } else {
        $(this).fadeOut(200);
      }
    });
  }

  // header search autosuggest
  const $searchInput = $('#search-input');
  const $searchSuggestions = $('#search-suggestions');
  let searchTimeout = null;

  $(document).on('input keyup', '#search-input, input[name="search"]', function () {
    const query = $(this).val();
    $('#search-input, input[name="search"]').not(this).val(query);
    liveFilterProducts(query);
  });

  if ($searchInput.length > 0) {
    $searchInput.on('input', function() {
      const query = $(this).val().trim();
      
      clearTimeout(searchTimeout);
      
      if (query.length === 0) {
        $searchSuggestions.hide().empty();
        return;
      }

      searchTimeout = setTimeout(function() {
        $.getJSON('/api/search?q=' + encodeURIComponent(query), function(data) {
          if (data && data.length > 0) {
            let html = '';
            data.forEach(item => {
              html += `
                <a href="/product/${item.id}" class="suggestion-item">
                  <img src="${item.imagePath}" class="suggestion-img" alt="${item.name}">
                  <div class="suggestion-info">
                    <span class="suggestion-name">${item.name}</span>
                    <span class="suggestion-price">BDT ${item.price.toLocaleString('en-BD')}</span>
                  </div>
                </a>
              `;
            });
            $searchSuggestions.html(html).show();
          } else {
            $searchSuggestions.html('<div style="padding: 12px 16px; color: var(--text-muted); font-size: 0.9rem;">No products found.</div>').show();
          }
        });
      }, 300);
    });

    $(document).on('click', function(e) {
      if (!$(e.target).closest('#search-form').length) {
        $searchSuggestions.hide();
      }
    });

    $searchInput.on('focus', function() {
      if ($(this).val().trim().length > 0 && $searchSuggestions.children().length > 0) {
        $searchSuggestions.show();
      }
    });
  }

  // admin product filtering
  $(document).on('input keyup', '#admin-product-search', function () {
    const query = $(this).val().toLowerCase().trim();
    $('.data-table tbody tr').each(function () {
      const name = $(this).find('td:nth-child(2) div:first-child').text().toLowerCase();
      const category = $(this).find('td:nth-child(2) div:last-child').text().toLowerCase();
      const matches = name.indexOf(query) > -1 || category.indexOf(query) > -1;
      $(this).toggle(matches);
    });
  });

});
