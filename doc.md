# yêu cầu
- giao diện đẹp css boostrap đẹp
- hệ thống app desktop cho phép đăng nhập 
- phân quyền các role : admin, support, designer, printer, cuter, picker, processer
- admin full chức năng
- support, designer, printer chỉ hiện trang reprint 
- connect database dùng firebase 
- thông tin show Reprint show như mẫu ở D:\PressifyReprintApp\templete
- migrate tạo table reprints 
    support_id 
    order_id
    reason_reprint_id	
    note : text
    product_variant_id
    user_error_id	
    reason_error : text
    user_note_id
    status : text
    created_at
    updated_at
table order_type
    name 
table reason_reprints
    name
table product
    name
table product_variant
    product_id
    color
    size
table timeline
    user_id
    reprint_id
    note
    time_vn (Asian\HCM)
    time_us (American\Chicago)
# chức năng
    - Dashboard : thống kê reprint
    - Reprint : show giao diện reprint 
    - Product : cho phép import từ sheet
    - Permission : phân quyền từng thao tác 
    show reprint STT ,Support Name,LINK_ID,ORDER ID,LÍ DO REPRINT,NOTE (TEAM GANGSHEET NOTE LÊN ĐỂ IN),LOẠI ÁO,SIZE,COLOR,HÃNG ÁO,MACHINE #,AI LÀM SAI,LÝ DO LỖI,NOTE,STATUS (GANGSHEET),,Finished date
        Support Name : show select cho phép chọn support 
        ORDER ID : input nhập
        LÍ DO REPRINT : show select chọn từ reason_reprints
        NOTE (TEAM GANGSHEET NOTE LÊN ĐỂ IN) : text
        LOẠI ÁO,SIZE,COLOR : cho phép chọn product -> filter chọn color, size product_variant của product để lưu product_variant_id cho reprint đó
        AI LÀM SAI : show select role processer
        ,LÝ DO LỖI : show input cho nhận text
        ,NOTE : show input cho nhập text
        ,STATUS (GANGSHEET) : not yet,processing ,completed,printed
        ,Finished date : chọn datetime