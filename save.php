<?php
	function gen_name($data, $len=5) {
		//use the md5 sum to generate the name
		$name = strtoupper(substr(md5($data), 0, $len));

		if (file_exists("saved-code/".$name.".json")) {
			//another file exists with the same name. Are the contents equal?
			$fdata = file_get_contents("saved-code/".$name.".json");
			if (strcmp($fdata, $data) != 0) {
				//no... we need a different name
				return gen_name($data, $len+1);
			}
		}
		return $name;
	}

	//get data 
	$data = $_REQUEST['data'];

	//generate a local file name
	$name = gen_name($data);
	
	//write contents
	file_put_contents("saved-code/".$name.".json", $data, LOCK_EX);

	echo $name;
?>